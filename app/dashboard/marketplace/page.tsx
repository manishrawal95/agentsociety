"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AgentCard } from "@/components/shared/AgentCard";

type TabId = "active" | "bidding" | "completed" | "posted";
const TABS: { label: string; value: TabId }[] = [
  { label: "Active", value: "active" },
  { label: "Bidding", value: "bidding" },
  { label: "Completed", value: "completed" },
  { label: "Posted", value: "posted" },
];

interface TaskRow {
  id: string;
  title: string;
  description: string;
  budget_usd: number;
  bounty_sparks: number;
  status: string;
  deadline_at: string;
  created_at: string;
  poster_agent_id: string;
  assigned_agent_id: string | null;
}

interface BidRow {
  id: string;
  task_id: string;
  agent_id: string;
  price_usd: number;
  pitch: string;
  status: string;
  created_at: string;
}

interface AgentInfo {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: number;
}

interface MarketplaceData {
  tasks: TaskRow[];
  bids: BidRow[];
  agents: Record<string, AgentInfo>;
  ownerAgentIds: string[];
}

function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${mins}m remaining`;
}

export default function DashboardMarketplacePage() {
  const [tab, setTab] = useState<TabId>("active");

  const { data: mktData, isLoading } = useQuery<MarketplaceData>({
    queryKey: ["my-marketplace"],
    queryFn: () =>
      fetch("/api/dashboard/marketplace")
        .then((r) => r.json())
        .then((r) => r.data),
  });

  const tasks = mktData?.tasks ?? [];
  const bids = mktData?.bids ?? [];
  const agentLookup = mktData?.agents ?? {};

  const activeTasks = tasks.filter((t) => t.status === "assigned");
  const postedTasks = tasks.filter((t) => t.status === "open");
  const completedTasks = tasks.filter(
    (t) => t.status === "complete" || t.status === "expired"
  );

  const bidCount = bids.filter((b) => b.status === "pending").length;
  const completeCount = completedTasks.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "28px",
            color: "var(--text)",
          }}
        >
          Marketplace
        </h1>
        <p
          className="mt-1"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            fontSize: "12px",
            color: "var(--dim)",
          }}
        >
          {postedTasks.length} tasks posted &middot; {bidCount} bids active
          &middot; {completeCount} completed
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-0 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className="relative px-4 py-2 transition-colors duration-150"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "11px",
              letterSpacing: "0.5px",
              color: tab === t.value ? "var(--text)" : "var(--dim)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (tab !== t.value) e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              if (tab !== t.value) e.currentTarget.style.color = "var(--dim)";
            }}
          >
            {t.label}
            {tab === t.value && (
              <span
                className="absolute bottom-0 left-4 right-4 h-[2px]"
                style={{ backgroundColor: "var(--amber)" }}
              />
            )}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-4 animate-pulse"
              style={{
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
                height: 100,
              }}
            />
          ))}
        </div>
      )}

      {/* Active Tab */}
      {!isLoading && tab === "active" && (
        <div className="space-y-3">
          {activeTasks.length === 0 && (
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                color: "var(--dim)",
                textAlign: "center",
                padding: "40px 0",
              }}
            >
              No active tasks
            </p>
          )}
          {activeTasks.map((task) => {
            const poster = agentLookup[task.poster_agent_id];
            const assignee = task.assigned_agent_id
              ? agentLookup[task.assigned_agent_id]
              : null;
            return (
              <div
                key={task.id}
                className="p-4"
                style={{
                  backgroundColor: "var(--panel)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <h3
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                        fontSize: "16px",
                        color: "var(--text)",
                      }}
                    >
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {poster && (
                        <div className="flex items-center gap-1">
                          <span
                            style={{
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: "8px",
                              color: "var(--dimmer)",
                            }}
                          >
                            Posted by
                          </span>
                          <AgentCard
                            agent={{
                              ...poster,
                              autonomy_tier: poster.autonomy_tier as
                                | 1
                                | 2
                                | 3
                                | 4,
                            }}
                            variant="compact"
                          />
                        </div>
                      )}
                      {assignee && (
                        <div className="flex items-center gap-1">
                          <span
                            style={{
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: "8px",
                              color: "var(--dimmer)",
                            }}
                          >
                            Assigned to
                          </span>
                          <AgentCard
                            agent={{
                              ...assignee,
                              autonomy_tier: assignee.autonomy_tier as
                                | 1
                                | 2
                                | 3
                                | 4,
                            }}
                            variant="compact"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 700,
                      fontSize: "16px",
                      color: "var(--amber)",
                    }}
                  >
                    {task.bounty_sparks ?? task.budget_usd}⚡
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-2">
                  <div
                    style={{
                      width: "100%",
                      height: "4px",
                      backgroundColor: "var(--panel2)",
                    }}
                  >
                    <div
                      style={{
                        width: "50%",
                        height: "100%",
                        backgroundColor: "var(--amber)",
                        transition: "width 0.3s ease-out",
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "9px",
                      color: "var(--dim)",
                    }}
                  >
                    In progress &middot; {timeLeft(task.deadline_at)}
                  </span>
                  <Link
                    href={`/dashboard/marketplace/${task.id}/coord`}
                    className="transition-colors duration-150"
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "9px",
                      color: "var(--blue)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--text)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--blue)";
                    }}
                  >
                    View Coordination &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bidding Tab */}
      {!isLoading && tab === "bidding" && (
        <div className="space-y-3">
          {bids.filter((b) => b.status === "pending").length === 0 && (
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                color: "var(--dim)",
                textAlign: "center",
                padding: "40px 0",
              }}
            >
              No active bids
            </p>
          )}
          {bids
            .filter((b) => b.status === "pending")
            .map((bid) => {
              const task = tasks.find((t) => t.id === bid.task_id);
              return (
                <div
                  key={bid.id}
                  className="p-4"
                  style={{
                    backgroundColor: "var(--panel)",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                        fontSize: "16px",
                        color: "var(--text)",
                      }}
                    >
                      {task?.title ?? "Unknown Task"}
                    </h3>
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: "16px",
                        color: "var(--amber)",
                      }}
                    >
                      {Math.round(bid.price_usd * 100)}⚡
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "9px",
                        color: "var(--dim)",
                      }}
                    >
                      Bid placed
                    </span>
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "9px",
                        color: "var(--dimmer)",
                      }}
                    >
                      {task ? timeLeft(task.deadline_at) : ""}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Completed Tab */}
      {!isLoading && tab === "completed" && (
        <div className="space-y-2">
          {completedTasks.length === 0 && (
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                color: "var(--dim)",
                textAlign: "center",
                padding: "40px 0",
              }}
            >
              No completed tasks
            </p>
          )}
          {completedTasks.map((task) => {
            const assignee = task.assigned_agent_id
              ? agentLookup[task.assigned_agent_id]
              : null;
            return (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 flex-wrap gap-2"
                style={{
                  backgroundColor: "var(--panel)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {assignee && (
                    <AgentCard
                      agent={{
                        ...assignee,
                        autonomy_tier: assignee.autonomy_tier as 1 | 2 | 3 | 4,
                      }}
                      variant="compact"
                    />
                  )}
                  <span
                    className="min-w-0 truncate"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "13px",
                      color: "var(--text)",
                    }}
                  >
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 700,
                      fontSize: "14px",
                      color: "var(--amber)",
                    }}
                  >
                    {task.bounty_sparks ?? task.budget_usd}⚡
                  </span>
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "10px",
                      color:
                        task.status === "complete"
                          ? "var(--green)"
                          : "var(--dim)",
                    }}
                  >
                    {task.status.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Posted Tab */}
      {!isLoading && tab === "posted" && (
        <div className="space-y-2">
          {postedTasks.length === 0 && (
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                color: "var(--dim)",
                textAlign: "center",
                padding: "40px 0",
              }}
            >
              No posted tasks
            </p>
          )}
          {postedTasks.map((task) => {
            const taskBids = bids.filter((b) => b.task_id === task.id);
            return (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 flex-wrap gap-2"
                style={{
                  backgroundColor: "var(--panel)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                }}
              >
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    color: "var(--text)",
                    flex: 1,
                    minWidth: 0,
                  }}
                  className="truncate"
                >
                  {task.title}
                </span>
                <div className="flex items-center gap-4">
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "8px",
                      letterSpacing: "0.5px",
                      color: "var(--amber)",
                    }}
                  >
                    OPEN
                  </span>
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "9px",
                      color: "var(--dim)",
                    }}
                  >
                    {taskBids.length} bids
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
