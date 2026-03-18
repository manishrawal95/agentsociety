"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";

interface AgentCost {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  model: string;
  provider: string;
  cost_today_usd: number;
  daily_budget_usd: number;
  status: string;
}

interface CostLogEntry {
  id: string;
  agent_id: string;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  job_type: string;
  created_at: string;
}

interface CostsData {
  agents: AgentCost[];
  costLog: CostLogEntry[];
}

const mono9: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  color: "var(--dim)",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

const headerCellStyle: React.CSSProperties = {
  ...mono9,
  padding: "10px 12px",
  textAlign: "left",
  whiteSpace: "nowrap",
};

export default function CostsPage() {
  const [hoveredBar, setHoveredBar] = React.useState<number | null>(null);

  const { data: costData, isLoading } = useQuery<CostsData>({
    queryKey: ["dashboard-costs"],
    queryFn: () =>
      fetch("/api/dashboard/costs")
        .then((r) => r.json())
        .then((r) => r.data),
  });

  const agents = costData?.agents ?? [];
  const costLog = costData?.costLog ?? [];

  const todayTotal = agents.reduce((sum, a) => sum + (a.cost_today_usd ?? 0), 0);
  const totalBudget = agents.reduce((sum, a) => sum + (a.daily_budget_usd ?? 0), 0);

  // Build daily cost chart from cost_log entries
  const dailyCosts: { day: number; cost: number }[] = [];
  const costByDay = new Map<string, number>();
  costLog.forEach((c) => {
    const day = new Date(c.created_at).toISOString().split("T")[0];
    costByDay.set(day, (costByDay.get(day) ?? 0) + c.cost_usd);
  });
  const sortedDays = Array.from(costByDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  sortedDays.forEach((entry, i) => {
    dailyCosts.push({ day: i + 1, cost: entry[1] });
  });

  const maxCost = dailyCosts.length > 0 ? Math.max(...dailyCosts.map((d) => d.cost), 0.01) : 0.50;
  const monthTotal = costLog.reduce((sum, c) => sum + c.cost_usd, 0);

  // Model breakdown from cost_log
  const modelMap = new Map<string, { cost: number; color: string }>();
  const modelColors = ["var(--amber)", "var(--blue)", "var(--green)", "var(--purple)", "var(--teal)", "var(--red)"];
  costLog.forEach((c) => {
    const existing = modelMap.get(c.model);
    if (existing) {
      existing.cost += c.cost_usd;
    } else {
      modelMap.set(c.model, { cost: c.cost_usd, color: modelColors[modelMap.size % modelColors.length] });
    }
  });
  const modelBreakdown = Array.from(modelMap.entries())
    .map(([model, data]) => ({
      model,
      cost: data.cost,
      pct: monthTotal > 0 ? Math.round((data.cost / monthTotal) * 100) : 0,
      color: data.color,
    }))
    .sort((a, b) => b.cost - a.cost);

  if (isLoading) {
    return (
      <div>
        <div className="mb-8">
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "28px",
              color: "var(--text)",
            }}
          >
            Cost Monitor
          </h1>
        </div>
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", color: "var(--dim)" }}>
            Loading cost data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "28px",
            color: "var(--text)",
          }}
        >
          Cost Monitor
        </h1>
        <p
          className="mt-1"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--dim)",
          }}
        >
          Today: ${todayTotal.toFixed(2)} &middot; Recorded total: ${monthTotal.toFixed(2)} &middot; Budget: ${totalBudget.toFixed(2)}
        </p>
      </div>

      {/* Chart */}
      {dailyCosts.length > 0 && (
        <div
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "20px",
            marginBottom: "24px",
          }}
        >
          <div style={mono9} className="mb-4">
            DAILY COSTS ({dailyCosts.length} DAYS)
          </div>
          <div className="flex items-end" style={{ height: "200px", gap: "2px", position: "relative" }}>
            {/* Y-axis labels */}
            <div
              className="flex flex-col justify-between shrink-0"
              style={{
                height: "200px",
                marginRight: "8px",
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                color: "var(--dimmer)",
                textAlign: "right",
                width: "32px",
              }}
            >
              <span>${maxCost.toFixed(2)}</span>
              <span>${(maxCost / 2).toFixed(2)}</span>
              <span>$0.00</span>
            </div>

            {/* Bars */}
            <div className="flex items-end flex-1" style={{ gap: "2px", height: "200px" }}>
              {dailyCosts.map((d) => {
                const heightPct = (d.cost / maxCost) * 100;
                const isHovered = hoveredBar === d.day;
                return (
                  <div
                    key={d.day}
                    className="flex-1 relative"
                    style={{ height: "100%", display: "flex", alignItems: "flex-end" }}
                    onMouseEnter={() => setHoveredBar(d.day)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: `${heightPct}%`,
                        backgroundColor: "var(--amber)",
                        opacity: isHovered ? 1 : 0.7,
                        transition: "opacity 150ms",
                        minHeight: "2px",
                      }}
                    />
                    {isHovered && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: `${heightPct + 5}%`,
                          left: "50%",
                          transform: "translateX(-50%)",
                          backgroundColor: "var(--panel2)",
                          border: "1px solid var(--border)",
                          padding: "2px 6px",
                          fontFamily: "var(--font-mono)",
                          fontSize: "8px",
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                          zIndex: 10,
                        }}
                      >
                        Day {d.day}: ${d.cost.toFixed(4)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Agent Breakdown Table */}
      <div style={{ overflowX: "auto", marginBottom: "24px" }}>
        <div style={mono9} className="mb-3">
          AGENT BREAKDOWN
        </div>
        {agents.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--dim)" }}>
              No agents found.
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--panel)" }}>
                <th style={headerCellStyle}>Agent</th>
                <th style={headerCellStyle}>Today</th>
                <th style={headerCellStyle}>Model</th>
                <th style={headerCellStyle}>Budget</th>
                <th style={headerCellStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <AgentCostRow key={agent.id} agent={agent} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Model Breakdown */}
      {modelBreakdown.length > 0 && (
        <div>
          <div style={mono9} className="mb-3">
            MODEL BREAKDOWN
          </div>
          <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
            {modelBreakdown.map((m) => (
              <div
                key={m.model}
                className="flex-1"
                style={{
                  minWidth: "200px",
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--border)",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    color: "var(--text)",
                    marginBottom: "8px",
                  }}
                >
                  {m.model}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    backgroundColor: "var(--panel2)",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      width: `${m.pct}%`,
                      height: "100%",
                      backgroundColor: m.color,
                    }}
                  />
                </div>
                <div className="flex justify-between">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      color: "var(--dim)",
                    }}
                  >
                    {m.pct}%
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      color: "var(--dim)",
                    }}
                  >
                    ${m.cost.toFixed(4)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentCostRow({ agent }: { agent: AgentCost }) {
  const [hovered, setHovered] = React.useState(false);

  const cellStyle: React.CSSProperties = {
    padding: "12px",
    borderBottom: "1px solid var(--border)",
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    color: "var(--text)",
  };

  const budgetPct = agent.daily_budget_usd > 0
    ? (agent.cost_today_usd / agent.daily_budget_usd) * 100
    : 0;
  const statusColor =
    agent.status === "paused" || agent.status === "suspended"
      ? "var(--dimmer)"
      : budgetPct > 90
        ? "var(--red)"
        : "var(--green)";
  const statusText =
    agent.status === "paused" || agent.status === "suspended"
      ? agent.status
      : budgetPct > 90
        ? "Near limit"
        : "Under";

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? "var(--panel2)" : "transparent",
        transition: "background-color 200ms",
      }}
    >
      <td style={cellStyle}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "12px" }}>{agent.avatar_emoji}</span>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "13px",
            }}
          >
            {agent.name}
          </span>
        </div>
      </td>
      <td style={cellStyle}>${agent.cost_today_usd.toFixed(2)}</td>
      <td style={cellStyle}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--dim)" }}>
          {agent.model}
        </span>
      </td>
      <td style={cellStyle}>${agent.daily_budget_usd.toFixed(2)}</td>
      <td style={{ ...cellStyle, color: statusColor }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            textTransform: "uppercase",
          }}
        >
          {statusText}
        </span>
      </td>
    </tr>
  );
}
