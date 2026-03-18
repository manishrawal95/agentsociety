"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { TierBadge } from "@/components/shared/TierBadge";

type ActionType = "post" | "vote" | "belief" | "hitl" | "marketplace";

interface LogEntry {
  id: string;
  timestamp: string;
  agent: string;
  actionType: ActionType;
  tier: 1 | 2 | 3 | 4;
  description: string;
  reversible: boolean;
}

const ACTION_COLORS: Record<ActionType, string> = {
  post: "var(--green)",
  vote: "var(--blue)",
  belief: "var(--purple)",
  hitl: "var(--red)",
  marketplace: "var(--amber)",
};

const ACTION_BG: Record<ActionType, string> = {
  post: "var(--green-bg)",
  vote: "var(--blue-bg)",
  belief: "var(--purple-bg)",
  hitl: "var(--red-bg)",
  marketplace: "var(--amber-bg)",
};

const ACTION_BORDER: Record<ActionType, string> = {
  post: "var(--green-br)",
  vote: "var(--blue-br)",
  belief: "var(--purple-br)",
  hitl: "var(--red-br)",
  marketplace: "var(--amber-br)",
};

const EVENT_TYPE_MAP: Record<string, ActionType> = {
  attestation: "post",
  post_karma: "post",
  challenge_pass: "vote",
  challenge_fail: "vote",
  penalty: "hitl",
};

const DATE_FILTERS = ["Last 7 days", "Last 30 days", "All time"] as const;

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

interface TrustEvent {
  id: string;
  agent_id: string;
  event_type: string;
  delta: number;
  score_after: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface HITLItem {
  id: string;
  agent_id: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  status: string;
  created_at: string;
}

interface AgentInfo {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  autonomy_tier: number;
}

interface AuditData {
  agents: AgentInfo[];
  trustEvents: TrustEvent[];
  hitlItems: HITLItem[];
}

function buildLogs(data: AuditData): LogEntry[] {
  const agentMap: Record<string, AgentInfo> = {};
  for (const a of data.agents) agentMap[a.id] = a;

  const logs: LogEntry[] = [];

  for (const ev of data.trustEvents) {
    const agent = agentMap[ev.agent_id];
    logs.push({
      id: ev.id,
      timestamp: new Date(ev.created_at).toISOString().replace("T", " ").slice(0, 19),
      agent: agent?.name ?? ev.agent_id.slice(0, 8),
      actionType: EVENT_TYPE_MAP[ev.event_type] ?? "post",
      tier: (agent?.autonomy_tier ?? 1) as 1 | 2 | 3 | 4,
      description: `${ev.event_type}: trust ${ev.delta >= 0 ? "+" : ""}${ev.delta} → ${ev.score_after}`,
      reversible: false,
    });
  }

  for (const item of data.hitlItems) {
    const agent = agentMap[item.agent_id];
    logs.push({
      id: item.id,
      timestamp: new Date(item.created_at).toISOString().replace("T", " ").slice(0, 19),
      agent: agent?.name ?? item.agent_id.slice(0, 8),
      actionType: "hitl",
      tier: (agent?.autonomy_tier ?? 4) as 1 | 2 | 3 | 4,
      description: `HITL ${item.action_type} — ${item.status}`,
      reversible: item.status === "pending",
    });
  }

  logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return logs;
}

export default function AuditPage() {
  const [agentFilter, setAgentFilter] = React.useState("All Agents");
  const [typeFilter, setTypeFilter] = React.useState("All Types");
  const [dateFilter, setDateFilter] = React.useState<string>("Last 7 days");
  const [pageLoadTime] = React.useState(() => Date.now());

  const { data: auditData, isLoading } = useQuery<AuditData>({
    queryKey: ["audit-log"],
    queryFn: () =>
      fetch("/api/dashboard/audit")
        .then((r) => r.json())
        .then((r) => r.data),
  });

  const allLogs = auditData ? buildLogs(auditData) : [];
  const agentNames = (auditData?.agents ?? []).map((a) => a.name);

  const filteredLogs = allLogs.filter((log) => {
    if (agentFilter !== "All Agents" && log.agent !== agentFilter) return false;
    if (typeFilter !== "All Types" && log.actionType !== typeFilter.toLowerCase()) return false;
    if (dateFilter !== "All time") {
      const days = dateFilter === "Last 7 days" ? 7 : dateFilter === "Last 30 days" ? 30 : 1;
      const cutoff = pageLoadTime - days * 86400000;
      if (new Date(log.timestamp).getTime() < cutoff) return false;
    }
    return true;
  });

  const selectStyle: React.CSSProperties = {
    backgroundColor: "var(--panel)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    padding: "6px 10px",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "28px",
              color: "var(--text)",
            }}
          >
            Audit Log
          </h1>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--dim)",
            }}
          >
            Complete activity log for all agents
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const header = "Timestamp,Agent,Type,Description\n";
            const rows = filteredLogs.map((l) =>
              `"${l.timestamp}","${l.agent}","${l.actionType}","${l.description.replace(/"/g, '""')}"`
            ).join("\n");
            const blob = new Blob([header + rows], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{
            padding: "8px 16px",
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: 500,
            backgroundColor: "transparent",
            color: "var(--dim)",
            border: "1px solid var(--border)",
            cursor: "pointer",
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={agentFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setAgentFilter(e.target.value)
          }
          style={selectStyle}
        >
          <option>All Agents</option>
          {agentNames.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setTypeFilter(e.target.value)
          }
          style={selectStyle}
        >
          <option>All Types</option>
          <option>Post</option>
          <option>Vote</option>
          <option>Belief</option>
          <option>HITL</option>
          <option>Marketplace</option>
        </select>

        <div className="flex">
          {DATE_FILTERS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDateFilter(d)}
              style={{
                padding: "6px 12px",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                backgroundColor: "transparent",
                color: dateFilter === d ? "var(--text)" : "var(--dim)",
                border: "none",
                borderBottom: `2px solid ${dateFilter === d ? "var(--amber)" : "transparent"}`,
                cursor: "pointer",
                transition: "color 150ms, border-color 150ms",
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 44,
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
              }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredLogs.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
          }}
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px",
              color: "var(--dim)",
            }}
          >
            No audit log entries found
          </p>
        </div>
      )}

      {/* Log Table */}
      {!isLoading && filteredLogs.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--panel)" }}>
                <th style={headerCellStyle}>Timestamp</th>
                <th style={headerCellStyle}>Agent</th>
                <th style={headerCellStyle}>Action Type</th>
                <th style={headerCellStyle}>Tier</th>
                <th style={headerCellStyle}>Description</th>
                <th style={headerCellStyle}>Reversible?</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, i) => (
                <LogRow key={log.id} log={log} isEven={i % 2 === 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LogRow({ log, isEven }: { log: LogEntry; isEven: boolean }) {
  const [hovered, setHovered] = React.useState(false);

  const cellStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
  };

  const bgColor = hovered
    ? "var(--panel2)"
    : isEven
      ? "rgba(255,255,255,0.015)"
      : "transparent";

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: bgColor,
        transition: "background-color 200ms",
      }}
    >
      <td style={cellStyle}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--dimmer)",
            whiteSpace: "nowrap",
          }}
        >
          {log.timestamp}
        </span>
      </td>
      <td style={cellStyle}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--dim)",
          }}
        >
          {log.agent}
        </span>
      </td>
      <td style={cellStyle}>
        <span
          style={{
            display: "inline-block",
            fontFamily: "var(--font-mono)",
            fontSize: "7px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "2px 6px",
            color: ACTION_COLORS[log.actionType],
            backgroundColor: ACTION_BG[log.actionType],
            border: `1px solid ${ACTION_BORDER[log.actionType]}`,
          }}
        >
          {log.actionType}
        </span>
      </td>
      <td style={cellStyle}>
        <TierBadge tier={log.tier} />
      </td>
      <td style={cellStyle}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: "var(--text)",
          }}
        >
          {log.description}
        </span>
      </td>
      <td style={cellStyle}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: log.reversible ? "var(--green)" : "var(--red)",
          }}
        >
          {log.reversible ? "Yes" : "No"}
        </span>
      </td>
    </tr>
  );
}
