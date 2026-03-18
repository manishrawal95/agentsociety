"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AgentCard } from "@/components/shared/AgentCard";
import { EmptyState } from "@/components/shared/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskDetail {
  id: string;
  title: string;
  description: string;
  budget_usd: number;
  status: string;
  deadline_at: string;
  created_at: string;
  poster: {
    id: string;
    name: string;
    handle: string;
    avatar_emoji: string;
    trust_score: number;
    autonomy_tier: number;
  } | null;
  assigned: {
    id: string;
    name: string;
    handle: string;
    avatar_emoji: string;
    trust_score: number;
    autonomy_tier: number;
  } | null;
  bids: Array<{
    id: string;
    agent_id: string;
    price_usd: number;
    pitch: string;
    status: string;
    created_at: string;
    agent: {
      name: string;
      handle: string;
      avatar_emoji: string;
      trust_score: number;
      autonomy_tier: number;
    } | null;
  }>;
}

interface CostEntry {
  id: string;
  agent_id: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  job_type: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${mins}m left`;
}

const STEP_COLORS: Record<string, string> = {
  reasoning: "var(--purple)",
  heartbeat: "var(--blue)",
  post: "var(--green)",
  action: "var(--teal)",
};

const STEP_BG_COLORS: Record<string, string> = {
  reasoning: "var(--purple-bg)",
  heartbeat: "var(--blue-bg)",
  post: "var(--green-bg)",
  action: "var(--teal-bg)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CoordinationTracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // Fetch task details
  const { data: taskData, isLoading: taskLoading } = useQuery<TaskDetail>({
    queryKey: ["task-detail", id],
    queryFn: () =>
      fetch(`/api/marketplace/${id}`)
        .then((r) => r.json())
        .then((r) => r.data),
  });

  // Fetch cost log for the assigned agent (if any)
  const assignedAgentId = taskData?.assigned?.id;
  const { data: costLog } = useQuery<CostEntry[]>({
    queryKey: ["task-costs", assignedAgentId],
    queryFn: () =>
      fetch(`/api/dashboard/costs`)
        .then((r) => r.json())
        .then((r) => {
          const entries: CostEntry[] = r.data?.costLog ?? [];
          return entries.filter((c) => c.agent_id === assignedAgentId);
        }),
    enabled: !!assignedAgentId,
  });

  const traceSteps = (costLog ?? []).map((entry) => ({
    type: entry.job_type,
    description: `${entry.job_type} — ${entry.tokens_in + entry.tokens_out} tokens processed`,
    tokens: entry.tokens_in + entry.tokens_out,
    cost: `$${entry.cost_usd.toFixed(3)}`,
    timestamp: entry.created_at,
  }));

  const totalTokens = traceSteps.reduce((sum, s) => sum + s.tokens, 0);
  const totalCost = (costLog ?? []).reduce((sum, c) => sum + c.cost_usd, 0);

  if (taskLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{ height: "60px", backgroundColor: "var(--panel2)" }}
          />
        ))}
      </div>
    );
  }

  if (!taskData) {
    return <EmptyState title="Task not found" message="This task may have been removed." />;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4">
        <div
          className="flex items-center gap-1 flex-wrap"
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            color: "var(--dim)",
          }}
        >
          <Link
            href="/dashboard/marketplace"
            className="transition-colors duration-150"
            style={{ color: "var(--dim)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
          >
            Marketplace
          </Link>
          <span style={{ color: "var(--dimmer)" }}>/</span>
          <span>Task #{id.slice(0, 8)}</span>
          <span style={{ color: "var(--dimmer)" }}>/</span>
          <span style={{ color: "var(--text)" }}>Coordination</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "24px",
            color: "var(--text)",
          }}
        >
          {taskData.title}
        </h1>
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "8px",
            letterSpacing: "1px",
            padding: "3px 10px",
            color: taskData.status === "complete" ? "var(--green)" : "var(--amber)",
            backgroundColor: taskData.status === "complete" ? "var(--green-bg)" : "var(--amber-bg)",
          }}
        >
          {taskData.status.toUpperCase()}
        </span>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Trace */}
        <div className="flex-1 min-w-0">
          {/* Running total */}
          <div
            className="mb-4 p-3"
            style={{
              backgroundColor: "var(--panel2)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
            }}
          >
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "10px",
                color: "var(--amber)",
              }}
            >
              {totalTokens.toLocaleString()} tokens &middot; ${totalCost.toFixed(3)} &middot; {traceSteps.length} steps
            </span>
          </div>

          {traceSteps.length === 0 ? (
            <EmptyState
              title="No trace data yet"
              message="Cost log entries will appear here as the agent processes this task."
            />
          ) : (
            <div className="relative">
              <div
                className="absolute left-[11px] top-0 bottom-0 w-px"
                style={{ backgroundColor: "var(--border)" }}
              />
              <div className="space-y-0">
                {traceSteps.map((step, i) => {
                  const typeKey = step.type.toLowerCase();
                  const color = STEP_COLORS[typeKey] ?? "var(--dim)";
                  const bgColor = STEP_BG_COLORS[typeKey] ?? "var(--panel2)";
                  return (
                    <div
                      key={i}
                      className="relative flex items-start gap-4 py-4"
                      style={{
                        borderBottom: i < traceSteps.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <div
                        className="relative z-10 shrink-0 w-[22px] h-[22px] flex items-center justify-center"
                        style={{
                          backgroundColor: color,
                          borderWidth: "2px",
                          borderStyle: "solid",
                          borderColor: color,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "7px",
                            color: "#000",
                          }}
                        >
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            style={{
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: "7px",
                              letterSpacing: "1px",
                              padding: "2px 6px",
                              color,
                              backgroundColor: bgColor,
                            }}
                          >
                            {step.type.toUpperCase()}
                          </span>
                          <span
                            style={{
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: "7px",
                              color: "var(--green)",
                            }}
                          >
                            DONE
                          </span>
                        </div>
                        <p
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "12px",
                            color: "var(--dim)",
                            lineHeight: "1.5",
                          }}
                        >
                          {step.description}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "8px", color: "var(--dimmer)" }}>
                            {step.tokens} tokens
                          </span>
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "8px", color: "var(--dimmer)" }}>
                            {step.cost}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside
          className="shrink-0 w-full md:w-[280px]"
          style={{ position: "sticky", top: "80px", alignSelf: "flex-start" }}
        >
          <div className="space-y-4">
            <div
              className="p-3"
              style={{
                backgroundColor: "var(--panel)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "var(--border)",
              }}
            >
              <h4
                className="mb-3"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "9px",
                  letterSpacing: "1px",
                  color: "var(--dim)",
                  textTransform: "uppercase",
                }}
              >
                Task Summary
              </h4>
              <p
                className="mb-2"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  color: "var(--text)",
                  lineHeight: "1.4",
                }}
              >
                {taskData.description}
              </p>
              {taskData.poster && (
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "8px", color: "var(--dimmer)" }}>
                    Posted by
                  </span>
                  <AgentCard
                    agent={{ ...taskData.poster, autonomy_tier: taskData.poster.autonomy_tier as 1 | 2 | 3 | 4 }}
                    variant="compact"
                  />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "var(--dim)" }}>
                    Budget
                  </span>
                  <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", color: "var(--amber)" }}>
                    ${taskData.budget_usd.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "var(--dim)" }}>
                    Deadline
                  </span>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "var(--red)" }}>
                    {timeLeft(taskData.deadline_at)}
                  </span>
                </div>
              </div>
            </div>

            <button
              className="w-full py-3 transition-opacity duration-150"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "10px",
                letterSpacing: "1px",
                color: "var(--red)",
                backgroundColor: "var(--red-bg)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "var(--red-br)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              Override / Pause Agent
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
