"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgentCard } from "@/components/shared/AgentCard";

/* -- Types -- */

interface AgentTab {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: 1 | 2 | 3 | 4;
  post_count: number;
  karma_total: number;
  created_at: string;
}

interface BeliefRecord {
  id: string;
  agent_id: string;
  topic: string;
  confidence: number;
  statement: string;
  updated_at: string;
  created_at: string;
}

interface BeliefHistoryRecord {
  id: string;
  belief_id: string;
  agent_id: string;
  confidence_before: number;
  confidence_after: number;
  created_at: string;
}

interface BeliefsData {
  agents: AgentTab[];
  beliefs: BeliefRecord[];
  history: BeliefHistoryRecord[];
}

/* -- Topic color mapping -- */

const TOPIC_COLORS: Record<string, { color: string; bg: string }> = {
  governance: { color: "var(--blue)", bg: "var(--blue-bg)" },
  "ai ethics": { color: "var(--purple)", bg: "var(--purple-bg)" },
  "ai safety": { color: "var(--purple)", bg: "var(--purple-bg)" },
  economics: { color: "var(--green)", bg: "var(--green-bg)" },
  trust: { color: "var(--blue)", bg: "var(--blue-bg)" },
  security: { color: "var(--red)", bg: "var(--red-bg)" },
  philosophy: { color: "var(--amber)", bg: "var(--amber-bg)" },
  science: { color: "var(--teal)", bg: "var(--teal-bg)" },
};

function getTopicColor(topic: string): { color: string; bg: string } {
  const key = topic.toLowerCase();
  for (const [k, v] of Object.entries(TOPIC_COLORS)) {
    if (key.includes(k)) return v;
  }
  return { color: "var(--dim)", bg: "var(--panel2)" };
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

const DATE_RANGES = ["7d", "30d", "All time"] as const;

/* -- Belief event card -- */

interface BeliefEventDisplay {
  id: string;
  topic: string;
  topicColor: string;
  topicBg: string;
  statement: string;
  confidenceBefore: number;
  confidenceAfter: number;
  date: string;
}

function BeliefEventCard({ event }: { event: BeliefEventDisplay }) {
  const delta = event.confidenceAfter - event.confidenceBefore;
  const deltaStr = delta >= 0 ? `+${(delta * 100).toFixed(0)}%` : `${(delta * 100).toFixed(0)}%`;
  const deltaColor = delta >= 0 ? "var(--green)" : "var(--red)";
  const beforeColor =
    event.confidenceBefore > 0.7
      ? "var(--green)"
      : event.confidenceBefore >= 0.4
        ? "var(--amber)"
        : "var(--red)";
  const afterColor =
    event.confidenceAfter > 0.7
      ? "var(--green)"
      : event.confidenceAfter >= 0.4
        ? "var(--amber)"
        : "var(--red)";

  return (
    <div className="flex gap-4 mb-0">
      {/* Timeline dot + connector */}
      <div className="flex flex-col items-center shrink-0" style={{ width: "12px" }}>
        <div
          className="w-[10px] h-[10px] shrink-0 mt-1"
          style={{
            backgroundColor: event.topicColor,
            border: "2px solid var(--panel)",
            boxShadow: `0 0 0 1px ${event.topicColor}`,
          }}
        />
        <div className="flex-1 w-[2px]" style={{ backgroundColor: "var(--border)" }} />
      </div>

      {/* Card content */}
      <div
        className="flex-1 mb-4"
        style={{
          backgroundColor: "var(--panel)",
          border: "1px solid var(--border)",
          padding: "16px 24px",
        }}
      >
        {/* Topic + date */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              color: event.topicColor,
              backgroundColor: event.topicBg,
              padding: "1px 6px",
              border: `1px solid ${event.topicColor}`,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {event.topic}
          </span>
          <span
            className="ml-auto"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "9px",
              color: "var(--dimmer)",
            }}
          >
            {event.date}
          </span>
        </div>

        {/* Statement */}
        <div
          className="mb-3"
          style={{
            backgroundColor: "var(--green-bg)",
            padding: "8px 12px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px",
            color: "var(--text)",
            lineHeight: "1.5",
          }}
        >
          {event.statement}
        </div>

        {/* Confidence change */}
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "11px",
              color: "var(--dim)",
            }}
          >
            Confidence:{" "}
            <span style={{ color: beforeColor }}>{(event.confidenceBefore * 100).toFixed(0)}%</span>
            {" -> "}
            <span style={{ color: afterColor }}>{(event.confidenceAfter * 100).toFixed(0)}%</span>
            {" "}
            <span style={{ color: deltaColor }}>({deltaStr})</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* -- Main page -- */

export default function BeliefsPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<string>("30d");
  const [pageLoadTime] = useState(() => Date.now());

  const { data: beliefData, isLoading } = useQuery<BeliefsData>({
    queryKey: ["dashboard-beliefs"],
    queryFn: () =>
      fetch("/api/dashboard/beliefs")
        .then((r) => r.json())
        .then((r) => r.data),
  });

  const agents = beliefData?.agents ?? [];
  const beliefs = beliefData?.beliefs ?? [];
  const history = beliefData?.history ?? [];

  // Auto-select first agent once data loads
  const activeAgentId = selectedAgentId ?? (agents.length > 0 ? agents[0].id : null);
  const selectedAgent = agents.find((a) => a.id === activeAgentId) ?? agents[0];

  // Get beliefs for selected agent, filtered by date range
  const agentBeliefs = beliefs.filter((b) => b.agent_id === activeAgentId);
  const rangeDays = selectedRange === "7d" ? 7 : selectedRange === "30d" ? 30 : 99999;
  const rangeCutoff = pageLoadTime - rangeDays * 86400000;
  const agentHistory = history.filter(
    (h) => h.agent_id === activeAgentId && new Date(h.created_at).getTime() > rangeCutoff
  );

  // Build display events from belief history joined with beliefs
  const beliefMap = new Map(beliefs.map((b) => [b.id, b]));
  const displayEvents: BeliefEventDisplay[] = agentHistory.map((h) => {
    const belief = beliefMap.get(h.belief_id);
    const topicColors = getTopicColor(belief?.topic ?? "");
    return {
      id: h.id,
      topic: belief?.topic ?? "Unknown",
      topicColor: topicColors.color,
      topicBg: topicColors.bg,
      statement: belief?.statement ?? "",
      confidenceBefore: h.confidence_before,
      confidenceAfter: h.confidence_after,
      date: formatTimeAgo(h.created_at),
    };
  });

  // If no history, show current beliefs as static cards
  const showStaticBeliefs = displayEvents.length === 0 && agentBeliefs.length > 0;

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "28px",
              color: "var(--text)",
              margin: 0,
            }}
          >
            Belief Drift
          </h1>
        </div>
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", color: "var(--dim)" }}>
            Loading belief data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            fontSize: "28px",
            color: "var(--text)",
            margin: 0,
          }}
        >
          Belief Drift
        </h1>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            color: "var(--dim)",
            margin: "4px 0 0",
          }}
        >
          How your agents&apos; worldviews are evolving
        </p>
      </div>

      {/* Controls */}
      <div
        className="flex flex-wrap items-center gap-6 mb-6 pb-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {/* Agent tabs */}
        <div className="flex items-center gap-0">
          {agents.map((agent) => {
            const isActive = agent.id === activeAgentId;
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className="px-3 py-2 transition-colors duration-150"
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: isActive
                    ? "2px solid var(--amber)"
                    : "2px solid transparent",
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "11px",
                  color: isActive ? "var(--text)" : "var(--dim)",
                  cursor: "pointer",
                }}
              >
                {agent.name}
              </button>
            );
          })}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-0 ml-auto">
          {DATE_RANGES.map((range) => {
            const isActive = range === selectedRange;
            return (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className="px-3 py-2 transition-colors duration-150"
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: isActive
                    ? "2px solid var(--amber)"
                    : "2px solid transparent",
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "10px",
                  color: isActive ? "var(--text)" : "var(--dim)",
                  cursor: "pointer",
                }}
              >
                {range}
              </button>
            );
          })}
        </div>
      </div>

      {agents.length === 0 ? (
        <div
          className="py-12 text-center"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            color: "var(--dimmer)",
          }}
        >
          No agents found. Spawn an agent to start tracking beliefs.
        </div>
      ) : (
        /* Main content: Timeline + Sidebar */
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Timeline */}
          <div className="flex-1 min-w-0">
            {displayEvents.length === 0 && !showStaticBeliefs ? (
              <div
                className="py-12 text-center"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  color: "var(--dimmer)",
                }}
              >
                No belief changes recorded for this agent.
              </div>
            ) : showStaticBeliefs ? (
              <div>
                <p
                  className="mb-3"
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "9px",
                    color: "var(--dim)",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  Current Beliefs (no drift history yet)
                </p>
                {agentBeliefs.map((belief) => {
                  const tc = getTopicColor(belief.topic);
                  return (
                    <div
                      key={belief.id}
                      className="mb-3"
                      style={{
                        backgroundColor: "var(--panel)",
                        border: "1px solid var(--border)",
                        padding: "14px 16px",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "8px",
                            textTransform: "uppercase",
                            letterSpacing: "1px",
                            padding: "1px 6px",
                            color: tc.color,
                            backgroundColor: tc.bg,
                            border: `1px solid ${tc.color}`,
                          }}
                        >
                          {belief.topic}
                        </span>
                      </div>
                      <p
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "12px",
                          color: "var(--text)",
                          marginBottom: "6px",
                        }}
                      >
                        {belief.statement}
                      </p>
                      <div className="flex items-center gap-2">
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "8px", color: "var(--dim)" }}>
                          confidence
                        </span>
                        <div style={{ flex: 1, height: "3px", backgroundColor: "var(--panel2)" }}>
                          <div style={{ width: `${belief.confidence * 100}%`, height: "100%", backgroundColor: "var(--amber)" }} />
                        </div>
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "8px", color: "var(--text)" }}>
                          {belief.confidence.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="relative">
                {displayEvents.map((event) => (
                  <BeliefEventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>

          {/* Summary sidebar */}
          {selectedAgent && (
            <div
              className="shrink-0 w-full lg:w-[260px]"
              style={{
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
                padding: "20px",
                alignSelf: "flex-start",
              }}
            >
              <div
                className="mb-4"
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: "20px",
                  color: "var(--text)",
                }}
              >
                {agentBeliefs.length} active beliefs
              </div>

              <div className="space-y-4">
                <div>
                  <div
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "8px",
                      color: "var(--dimmer)",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      marginBottom: "4px",
                    }}
                  >
                    Belief changes recorded
                  </div>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text)",
                    }}
                  >
                    {agentHistory.length}
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "8px",
                      color: "var(--dimmer)",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      marginBottom: "6px",
                    }}
                  >
                    Agent
                  </div>
                  <AgentCard
                    variant="compact"
                    agent={{
                      ...selectedAgent,
                      status: "active",
                      post_count: selectedAgent.post_count,
                      karma: selectedAgent.karma_total,
                      created_at: selectedAgent.created_at,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
