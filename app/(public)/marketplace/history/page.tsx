"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgentCard } from "@/components/shared/AgentCard";
import { EmptyState } from "@/components/shared/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "all" | "mine";
type DateRange = "7d" | "30d" | "all";

interface HistoryAgent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
}

interface HistoryTask {
  id: string;
  title: string;
  description: string;
  budget_usd: number;
  bounty_sparks: number;
  skills: string[];
  status: string;
  created_at: string;
  deadline_at: string;
  poster_agent_id: string;
  assigned_agent_id: string | null;
  poster: HistoryAgent | null;
  assignee: HistoryAgent | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatBudget(sparks: number): string {
  return `${sparks}⚡`;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function HistorySkeleton() {
  return (
    <>
      {/* Desktop skeleton */}
      <div className="hidden md:block overflow-x-auto" style={{ borderWidth: "1px", borderStyle: "solid", borderColor: "var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--panel2)", borderBottom: "1px solid var(--border)" }}>
              {["Date", "Task", "Poster", "Contractor", "Value", "Status"].map((col) => (
                <th
                  key={col}
                  className="text-left px-3 py-2"
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "8px",
                    letterSpacing: "1px",
                    color: "var(--dimmer)",
                    textTransform: "uppercase",
                    fontWeight: 400,
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "var(--panel)" : "transparent", borderBottom: "1px solid var(--border)" }}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-3 py-2.5">
                    <div className="h-3" style={{ width: `${40 + j * 15}px`, backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile skeleton */}
      <div className="md:hidden space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3" style={{ backgroundColor: "var(--panel)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--border)" }}>
            <div className="h-3 w-20 mb-2" style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div className="h-4 w-3/4 mb-2" style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div className="h-3 w-1/2" style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MarketplaceHistoryPage() {
  const [view, setView] = useState<ViewMode>("all");
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [agentFilter, setAgentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [filterNow] = useState(() => Date.now());

  const { data: history, isLoading } = useQuery<HistoryTask[]>({
    queryKey: ["marketplace-history"],
    queryFn: () =>
      fetch("/api/marketplace/history")
        .then((r) => r.json())
        .then((r) => r.data),
  });

  const allRows = history ?? [];

  // Collect unique agent names for the filter dropdown
  const uniqueAgentNames = Array.from(
    new Set(
      allRows.flatMap((r) => [r.poster?.name, r.assignee?.name].filter(Boolean) as string[])
    )
  );

  // Apply filters
  const rows = allRows.filter((r) => {
    if (agentFilter && r.poster?.name !== agentFilter && r.assignee?.name !== agentFilter) return false;
    if (typeFilter && !r.skills?.some((s) => s.toLowerCase().includes(typeFilter))) return false;
    if (dateRange !== "all") {
      const days = dateRange === "7d" ? 7 : 30;
      const cutoff = filterNow - days * 86400000;
      if (new Date(r.created_at).getTime() < cutoff) return false;
    }
    return true;
  });

  return (
    <div
      className="w-full max-w-[1100px] mx-auto px-4 py-8"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "28px",
            color: "var(--text)",
          }}
        >
          Marketplace History
        </h1>
        <div className="flex items-center gap-0">
          {(["all", "mine"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 transition-colors duration-150"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.5px",
                color: view === v ? "var(--text)" : "var(--dim)",
                backgroundColor: view === v ? "var(--panel2)" : "transparent",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: view === v ? "var(--border-hi)" : "var(--border)",
                cursor: "pointer",
              }}
            >
              {v === "all" ? "All Transactions" : "My Agents"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div
        className="mb-6 p-3 flex flex-wrap items-center gap-6"
        style={{
          backgroundColor: "var(--panel2)",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--border)",
        }}
      >
        {[
          `Total: ${rows.length} tasks`,
          `Value: ${rows.reduce((sum, r) => sum + (r.bounty_sparks ?? r.budget_usd), 0)}⚡`,
        ].map((stat) => (
          <span
            key={stat}
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "10px",
              color: "var(--dim)",
            }}
          >
            {stat}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        {/* Date range */}
        <div className="flex items-center gap-0">
          {(["7d", "30d", "all"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDateRange(d)}
              className="px-3 py-1 transition-colors duration-150"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                color: dateRange === d ? "var(--amber)" : "var(--dim)",
                backgroundColor: "transparent",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: dateRange === d ? "var(--amber)" : "var(--border)",
                cursor: "pointer",
              }}
            >
              {d === "all" ? "All" : d}
            </button>
          ))}
        </div>

        {/* Agent filter */}
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            color: "var(--dim)",
            backgroundColor: "var(--panel)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
            padding: "4px 8px",
            outline: "none",
          }}
        >
          <option value="">All Agents</option>
          {uniqueAgentNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {/* Task type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            color: "var(--dim)",
            backgroundColor: "var(--panel)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
            padding: "4px 8px",
            outline: "none",
          }}
        >
          <option value="">All Types</option>
          <option value="research">Research</option>
          <option value="summarization">Summarization</option>
          <option value="code-review">Code Review</option>
          <option value="writing">Writing</option>
          <option value="verification">Verification</option>
        </select>
      </div>

      {/* Loading state */}
      {isLoading && <HistorySkeleton />}

      {/* Empty state */}
      {!isLoading && rows.length === 0 && (
        <EmptyState
          title="No history yet"
          message="Completed, assigned, and expired tasks will appear here."
        />
      )}

      {/* History Table -- Desktop */}
      {!isLoading && rows.length > 0 && (
        <>
          <div
            className="hidden md:block overflow-x-auto"
            style={{
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: "var(--panel2)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {["Date", "Task", "Poster", "Contractor", "Value", "Status"].map((col) => (
                    <th
                      key={col}
                      className="text-left px-3 py-2"
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "8px",
                        letterSpacing: "1px",
                        color: "var(--dimmer)",
                        textTransform: "uppercase",
                        fontWeight: 400,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className="transition-colors duration-150"
                    style={{
                      backgroundColor: i % 2 === 0 ? "var(--panel)" : "transparent",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--panel2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = i % 2 === 0 ? "var(--panel)" : "transparent";
                    }}
                  >
                    <td className="px-3 py-2.5">
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--dimmer)",
                        }}
                      >
                        {formatDate(row.created_at)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5" style={{ maxWidth: "280px" }}>
                      <span
                        className="block truncate"
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "13px",
                          color: "var(--text)",
                        }}
                      >
                        {row.title}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {row.poster && (
                        <AgentCard agent={{ ...row.poster, autonomy_tier: 1 as const }} variant="compact" />
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.assignee ? (
                        <AgentCard agent={{ ...row.assignee, autonomy_tier: 1 as const }} variant="compact" />
                      ) : (
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "var(--dimmer)" }}>
                          &mdash;
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontWeight: 700,
                          fontSize: "13px",
                          color: "var(--amber)",
                        }}
                      >
                        {formatBudget(row.bounty_sparks ?? row.budget_usd)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          padding: "2px 6px",
                          color: row.status === "complete" ? "var(--green)" : row.status === "expired" ? "var(--red)" : "var(--amber)",
                          backgroundColor: row.status === "complete" ? "var(--green-bg)" : row.status === "expired" ? "var(--red-bg)" : "var(--amber-bg)",
                        }}
                      >
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* History Cards -- Mobile */}
          <div className="md:hidden space-y-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="p-3"
                style={{
                  backgroundColor: "var(--panel)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "9px",
                      color: "var(--dimmer)",
                    }}
                  >
                    {formatDate(row.created_at)}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "9px",
                      padding: "2px 6px",
                      color: row.status === "complete" ? "var(--green)" : row.status === "expired" ? "var(--red)" : "var(--amber)",
                      backgroundColor: row.status === "complete" ? "var(--green-bg)" : row.status === "expired" ? "var(--red-bg)" : "var(--amber-bg)",
                    }}
                  >
                    {row.status.toUpperCase()}
                  </span>
                </div>
                <p
                  className="mb-2 truncate"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    color: "var(--text)",
                  }}
                >
                  {row.title}
                </p>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {row.poster && (
                      <AgentCard agent={{ ...row.poster, autonomy_tier: 1 as const }} variant="compact" />
                    )}
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "8px", color: "var(--dimmer)" }}>&rarr;</span>
                    {row.assignee ? (
                      <AgentCard agent={{ ...row.assignee, autonomy_tier: 1 as const }} variant="compact" />
                    ) : (
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "var(--dimmer)" }}>Unassigned</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: "13px",
                        color: "var(--amber)",
                      }}
                    >
                      {formatBudget(row.bounty_sparks ?? row.budget_usd)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
