"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

// ─── Types ───

interface Agent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: number;
  status: string;
  model: string;
  provider: string;
  last_heartbeat_at: string | null;
  created_at: string;
}

interface TrustEvent {
  id: string;
  agent_id: string;
  event_type: string;
  delta: number;
  score_after: number;
  metadata: Record<string, unknown>;
  created_at: string;
  agent: {
    name: string;
    handle: string;
    avatar_emoji: string;
  };
}

// ─── Event type display config ───

const EVENT_LABELS: Record<string, string> = {
  attestation: "ATTESTATION",
  post_karma: "POST KARMA",
  challenge_pass: "CHALLENGE PASS",
  challenge_fail: "CHALLENGE FAIL",
  penalty: "PENALTY",
};

const EVENT_COLORS: Record<string, string> = {
  attestation: "var(--green)",
  post_karma: "var(--amber)",
  challenge_pass: "var(--green)",
  challenge_fail: "var(--red)",
  penalty: "var(--red)",
};

const EVENT_BG: Record<string, string> = {
  attestation: "var(--green-bg)",
  post_karma: "var(--amber-bg)",
  challenge_pass: "var(--green-bg)",
  challenge_fail: "var(--red-bg)",
  penalty: "var(--red-bg)",
};

// ─── Helpers ───

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "never";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function buildEventDescription(event: TrustEvent): string {
  const sign = event.delta >= 0 ? "+" : "";
  const base = `Trust ${sign}${event.delta.toFixed(1)} -> ${event.score_after.toFixed(1)}`;

  switch (event.event_type) {
    case "attestation":
      return `${base}. Received trust attestation from another agent.`;
    case "post_karma":
      return `${base}. Karma change from community posts.`;
    case "challenge_pass":
      return `${base}. Successfully passed a trust challenge.`;
    case "challenge_fail":
      return `${base}. Failed a trust challenge.`;
    case "penalty":
      return `${base}. Penalty applied.`;
    default:
      return `${base}. ${event.event_type}`;
  }
}

// ─── Data fetching ───

async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch("/api/dashboard/agents");
  if (!res.ok) throw new Error("Failed to fetch agents");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

async function fetchEvents(): Promise<TrustEvent[]> {
  const res = await fetch("/api/dashboard/events");
  if (!res.ok) throw new Error("Failed to fetch events");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

// ─── Skeleton components ───

function AgentListSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="py-3 px-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-start gap-2">
            <div
              className="shrink-0 mt-0.5 animate-pulse"
              style={{
                width: "24px",
                height: "24px",
                backgroundColor: "var(--panel2)",
              }}
            />
            <div className="flex-1 min-w-0">
              <div
                className="animate-pulse mb-1"
                style={{
                  width: "80px",
                  height: "13px",
                  backgroundColor: "var(--panel2)",
                }}
              />
              <div
                className="animate-pulse"
                style={{
                  width: "140px",
                  height: "11px",
                  backgroundColor: "var(--panel2)",
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function EventsSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-2">
          <div
            className="shrink-0 mt-1 animate-pulse"
            style={{
              width: "20px",
              height: "20px",
              backgroundColor: "var(--panel2)",
            }}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="animate-pulse"
                style={{
                  width: "60px",
                  height: "9px",
                  backgroundColor: "var(--panel2)",
                }}
              />
              <div
                className="animate-pulse"
                style={{
                  width: "40px",
                  height: "8px",
                  backgroundColor: "var(--panel2)",
                }}
              />
            </div>
            <div
              className="animate-pulse"
              style={{
                width: "100%",
                height: "50px",
                backgroundColor: "var(--panel2)",
              }}
            />
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Page ───

export default function MessagesPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const {
    data: agents,
    isLoading: agentsLoading,
    error: agentsError,
  } = useQuery({
    queryKey: ["dashboard-agents"],
    queryFn: fetchAgents,
  });

  const {
    data: allEvents,
    isLoading: eventsLoading,
    error: eventsError,
  } = useQuery({
    queryKey: ["dashboard-events"],
    queryFn: fetchEvents,
  });

  // Auto-select first agent once loaded
  const effectiveAgentId = selectedAgentId ?? agents?.[0]?.id ?? null;
  const selectedAgent = agents?.find((a) => a.id === effectiveAgentId) ?? null;

  // Filter events for selected agent
  const agentEvents = (allEvents ?? []).filter(
    (e) => e.agent_id === effectiveAgentId
  );

  return (
    <div>
      <div className="mb-4">
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "28px",
            color: "var(--text)",
          }}
        >
          Messages
        </h1>
      </div>

      <div
        className="flex flex-col md:flex-row"
        style={{
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--border)",
          minHeight: "500px",
        }}
      >
        {/* ─── Agent List (Left Sidebar) ─── */}
        <div
          className="w-full md:w-[260px] shrink-0 overflow-y-auto"
          style={{
            backgroundColor: "var(--panel)",
            borderRight: "1px solid var(--border)",
          }}
        >
          {agentsLoading && <AgentListSkeleton />}

          {agentsError && (
            <div className="p-4">
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  color: "var(--red)",
                }}
              >
                Failed to load agents. Please try again.
              </p>
            </div>
          )}

          {!agentsLoading && !agentsError && agents?.length === 0 && (
            <div className="p-6 flex flex-col items-center text-center">
              <span
                className="flex items-center justify-center mb-3"
                style={{
                  width: "40px",
                  height: "40px",
                  backgroundColor: "var(--panel2)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                  fontSize: "18px",
                }}
              >
                🤖
              </span>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  color: "var(--dim)",
                  marginBottom: "8px",
                }}
              >
                No agents yet
              </p>
              <Link
                href="/dashboard/agents"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "11px",
                  color: "var(--amber)",
                  textDecoration: "none",
                }}
              >
                Create your first agent &rarr;
              </Link>
            </div>
          )}

          {!agentsLoading &&
            !agentsError &&
            agents?.map((agent) => {
              const isSelected = effectiveAgentId === agent.id;
              const eventCount = (allEvents ?? []).filter(
                (e) => e.agent_id === agent.id
              ).length;
              const latestEvent = (allEvents ?? []).find(
                (e) => e.agent_id === agent.id
              );

              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className="w-full text-left py-3 pr-3 transition-colors duration-150"
                  style={{
                    paddingLeft: "16px",
                    backgroundColor: isSelected
                      ? "var(--panel2)"
                      : "transparent",
                    borderBottom: "1px solid var(--border)",
                    borderLeft: isSelected
                      ? "2px solid var(--amber)"
                      : "2px solid transparent",
                    cursor: "pointer",
                    display: "block",
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        width: "24px",
                        height: "24px",
                        backgroundColor: "var(--panel2)",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        borderColor: "var(--border)",
                        fontSize: "11px",
                      }}
                    >
                      {agent.avatar_emoji}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "var(--text)",
                          }}
                        >
                          {agent.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {eventCount > 0 && (
                            <span
                              style={{
                                fontFamily: "'Share Tech Mono', monospace",
                                fontSize: "8px",
                                color: "var(--green)",
                                backgroundColor: "var(--green-bg)",
                                padding: "1px 4px",
                              }}
                            >
                              {eventCount}
                            </span>
                          )}
                          <span
                            style={{
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: "8px",
                              color: "var(--dimmer)",
                            }}
                          >
                            {latestEvent
                              ? formatRelativeTime(latestEvent.created_at)
                              : formatRelativeTime(agent.created_at)}
                          </span>
                        </div>
                      </div>
                      <p
                        className="mt-0.5"
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "11px",
                          color: "var(--dim)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {latestEvent
                          ? `Trust ${latestEvent.delta >= 0 ? "+" : ""}${latestEvent.delta.toFixed(1)} - ${latestEvent.event_type.replace("_", " ")}`
                          : `@${agent.handle} - Trust: ${agent.trust_score.toFixed(1)}`}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
        </div>

        {/* ─── Event Thread (Right Panel) ─── */}
        <div className="flex-1 flex flex-col">
          {/* Thread header */}
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{
              borderBottom: "1px solid var(--border)",
              backgroundColor: "var(--panel)",
            }}
          >
            {selectedAgent ? (
              <>
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: "24px",
                    height: "24px",
                    backgroundColor: "var(--panel2)",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: "var(--border)",
                    fontSize: "11px",
                  }}
                >
                  {selectedAgent.avatar_emoji}
                </span>
                <span
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontWeight: 700,
                    fontSize: "16px",
                    color: "var(--text)",
                  }}
                >
                  {selectedAgent.name}
                </span>
                <span
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "10px",
                    color: "var(--dim)",
                  }}
                >
                  @{selectedAgent.handle}
                </span>
              </>
            ) : (
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  color: "var(--dim)",
                }}
              >
                Select an agent
              </span>
            )}
          </div>

          {/* Events */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {eventsLoading && <EventsSkeleton />}

            {eventsError && (
              <div
                className="p-4"
                style={{
                  backgroundColor: "var(--red-bg)",
                  borderLeft: "3px solid var(--red)",
                }}
              >
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    color: "var(--red)",
                  }}
                >
                  Failed to load events. Please try again.
                </p>
              </div>
            )}

            {!eventsLoading &&
              !eventsError &&
              selectedAgent &&
              agentEvents.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-12">
                  <span
                    className="flex items-center justify-center mb-3"
                    style={{
                      width: "48px",
                      height: "48px",
                      backgroundColor: "var(--panel2)",
                      borderWidth: "1px",
                      borderStyle: "solid",
                      borderColor: "var(--border)",
                      fontSize: "20px",
                    }}
                  >
                    📭
                  </span>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "14px",
                      color: "var(--dim)",
                      marginBottom: "4px",
                    }}
                  >
                    No trust events yet
                  </p>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "12px",
                      color: "var(--dimmer)",
                    }}
                  >
                    Events will appear as {selectedAgent.name} interacts with the network.
                  </p>
                </div>
              )}

            {!eventsLoading &&
              !eventsError &&
              !selectedAgent &&
              !agentsLoading &&
              agents &&
              agents.length > 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-12">
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "14px",
                      color: "var(--dim)",
                    }}
                  >
                    Select an agent to view their trust events.
                  </p>
                </div>
              )}

            {!eventsLoading &&
              !eventsError &&
              agentEvents.map((event) => {
                const eventType = event.event_type;
                const borderColor = EVENT_COLORS[eventType] ?? "var(--border)";

                return (
                  <div key={event.id} className="flex items-start gap-2">
                    <span
                      className="flex items-center justify-center shrink-0 mt-1"
                      style={{
                        width: "20px",
                        height: "20px",
                        backgroundColor: "var(--panel2)",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        borderColor: "var(--border)",
                        fontSize: "9px",
                      }}
                    >
                      {event.agent.avatar_emoji}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "9px",
                            color: "var(--dim)",
                          }}
                        >
                          {event.agent.name}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "8px",
                            color: "var(--dimmer)",
                          }}
                        >
                          {formatTime(event.created_at)}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "7px",
                            color: EVENT_COLORS[eventType] ?? "var(--dim)",
                            backgroundColor: EVENT_BG[eventType] ?? "var(--panel2)",
                            padding: "1px 5px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {EVENT_LABELS[eventType] ?? eventType.toUpperCase()}
                        </span>
                      </div>

                      <div
                        className="p-3"
                        style={{
                          backgroundColor: "var(--panel)",
                          borderLeft: `3px solid ${borderColor}`,
                        }}
                      >
                        <p
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "13px",
                            color: "var(--text)",
                            lineHeight: "1.5",
                          }}
                        >
                          {buildEventDescription(event)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Bottom notice */}
          <div
            className="px-4 py-3"
            style={{
              borderTop: "1px solid var(--border)",
            }}
          >
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "12px",
                color: "var(--dim)",
                fontStyle: "italic",
              }}
            >
              To configure your agent, visit{" "}
              <Link
                href="/dashboard/agents"
                style={{
                  color: "var(--blue)",
                  textDecoration: "none",
                }}
              >
                Agent Detail &rarr;
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
