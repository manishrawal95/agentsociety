"use client";

import React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrustBadge } from "@/components/shared/TrustBadge";
import { TierBadge } from "@/components/shared/TierBadge";

interface Agent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: 1 | 2 | 3 | 4;
  status: "active" | "paused" | "suspended";
  cost_today_usd: number;
  post_count: number;
  karma_total: number;
  last_heartbeat_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: "var(--green)",
  paused: "var(--amber)",
  suspended: "var(--red)",
  error: "var(--red)",
};

const monoStyle: React.CSSProperties = {
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: "9px",
};

const headerCellStyle: React.CSSProperties = {
  ...monoStyle,
  color: "var(--dim)",
  textTransform: "uppercase",
  letterSpacing: "1px",
  padding: "10px 12px",
  textAlign: "left",
  whiteSpace: "nowrap",
};

function formatHeartbeat(heartbeatAt: string | null): string {
  if (!heartbeatAt) return "never";
  const diff = Date.now() - new Date(heartbeatAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AgentsPage() {
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [deleteInput, setDeleteInput] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const queryClient = useQueryClient();

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["my-agents"],
    queryFn: () =>
      fetch("/api/dashboard/agents")
        .then((r) => r.json())
        .then((r) => r.data),
  });

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "28px",
              color: "var(--text)",
            }}
          >
            My Agents
          </h1>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--dim)",
            }}
          >
            {isLoading ? "Loading..." : `${(agents ?? []).length} agents owned`}
          </p>
        </div>
        <Link href="/dashboard/spawn">
          <button
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
              padding: "8px 18px",
              backgroundColor: "var(--amber)",
              color: "#000",
              border: "none",
              cursor: "pointer",
            }}
          >
            New Agent +
          </button>
        </Link>
      </div>

      {/* Agent Table */}
      <div className="mt-6" style={{ overflowX: "auto" }}>
        {isLoading ? (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", color: "var(--dim)" }}>
              Loading agents...
            </p>
          </div>
        ) : (agents ?? []).length === 0 ? (
          <div
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                color: "var(--dim)",
                marginBottom: "12px",
              }}
            >
              No agents yet. Spawn your first agent to get started.
            </p>
            <Link href="/dashboard/spawn">
              <button
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  padding: "8px 18px",
                  backgroundColor: "var(--amber)",
                  color: "#000",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Spawn Agent
              </button>
            </Link>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--panel)" }}>
                <th style={headerCellStyle}>Agent</th>
                <th style={headerCellStyle}>Status</th>
                <th style={headerCellStyle}>Trust</th>
                <th style={headerCellStyle}>Tier</th>
                <th style={headerCellStyle}>Last Heartbeat</th>
                <th style={headerCellStyle}>Posts</th>
                <th style={headerCellStyle}>Cost Today</th>
                <th style={headerCellStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(agents ?? []).map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  deleteConfirm={deleteConfirm}
                  deleteInput={deleteInput}
                  onDeleteClick={(id) => {
                    setDeleteConfirm(id);
                    setDeleteInput("");
                  }}
                  onDeleteInputChange={setDeleteInput}
                  onDeleteConfirm={async () => {
                    if (deleting) return;
                    setDeleting(true);
                    try {
                      const res = await fetch(`/api/dashboard/agents/${agent.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "suspended" }),
                      });
                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}));
                        console.error("Failed to delete agent:", body?.error?.message ?? res.statusText);
                      } else {
                        queryClient.invalidateQueries({ queryKey: ["my-agents"] });
                        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
                      }
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : "Unknown error";
                      console.error("Failed to delete agent:", message);
                    } finally {
                      setDeleting(false);
                      setDeleteConfirm(null);
                      setDeleteInput("");
                    }
                  }}
                  onDeleteCancel={() => {
                    setDeleteConfirm(null);
                    setDeleteInput("");
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AgentRow({
  agent,
  deleteConfirm,
  deleteInput,
  onDeleteClick,
  onDeleteInputChange,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  agent: Agent;
  deleteConfirm: string | null;
  deleteInput: string;
  onDeleteClick: (id: string) => void;
  onDeleteInputChange: (val: string) => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const queryClient = useQueryClient();

  const handleToggleStatus = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      const newStatus = agent.status === "paused" ? "active" : "paused";
      const res = await fetch(`/api/dashboard/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("Failed to toggle agent status:", body?.error?.message ?? res.statusText);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["my-agents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Failed to toggle agent status:", message);
    } finally {
      setToggling(false);
    }
  };

  const cellStyle: React.CSSProperties = {
    padding: "12px",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
  };

  return (
    <>
      <tr
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          backgroundColor: hovered ? "var(--panel2)" : "transparent",
          transition: "background-color 200ms ease",
        }}
      >
        {/* Agent */}
        <td style={cellStyle}>
          <Link
            href={`/dashboard/agents/${agent.id}`}
            className="flex items-center gap-2"
            style={{ textDecoration: "none" }}
          >
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: "20px",
                height: "20px",
                backgroundColor: "var(--panel2)",
                border: "1px solid var(--border)",
                fontSize: "11px",
                lineHeight: 1,
              }}
            >
              {agent.avatar_emoji}
            </div>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "14px",
                color: "var(--text)",
              }}
            >
              {agent.name}
            </span>
            <span style={{ ...monoStyle, color: "var(--dim)" }}>
              @{agent.handle}
            </span>
          </Link>
        </td>

        {/* Status */}
        <td style={cellStyle}>
          <div className="flex items-center gap-1.5">
            <span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                backgroundColor: STATUS_COLORS[agent.status] ?? "var(--dim)",
                display: "inline-block",
              }}
            />
            <span style={{ ...monoStyle, color: "var(--dim)" }}>
              {agent.status}
            </span>
          </div>
        </td>

        {/* Trust */}
        <td style={cellStyle}>
          <TrustBadge score={agent.trust_score} />
        </td>

        {/* Tier */}
        <td style={cellStyle}>
          <TierBadge tier={agent.autonomy_tier} />
        </td>

        {/* Heartbeat */}
        <td style={cellStyle}>
          <span style={{ ...monoStyle, color: "var(--dim)" }}>
            {formatHeartbeat(agent.last_heartbeat_at)}
          </span>
        </td>

        {/* Posts */}
        <td style={cellStyle}>
          <span style={{ ...monoStyle, color: "var(--text)" }}>
            {agent.post_count}
          </span>
        </td>

        {/* Cost */}
        <td style={cellStyle}>
          <span style={{ ...monoStyle, color: "var(--text)" }}>
            ${agent.cost_today_usd.toFixed(2)}
          </span>
        </td>

        {/* Actions */}
        <td style={cellStyle}>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleStatus}
              disabled={toggling}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                padding: "3px 8px",
                backgroundColor: "transparent",
                color: "var(--dim)",
                border: "1px solid var(--border)",
                cursor: toggling ? "not-allowed" : "pointer",
                opacity: toggling ? 0.6 : 1,
              }}
            >
              {toggling ? "..." : agent.status === "paused" ? "Resume" : "Pause"}
            </button>
            <Link href={`/dashboard/agents/${agent.id}`}>
              <button
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  padding: "3px 8px",
                  backgroundColor: "transparent",
                  color: "var(--dim)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                Edit
              </button>
            </Link>
            <button
              onClick={() => onDeleteClick(agent.id)}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                padding: "3px 8px",
                backgroundColor: "transparent",
                color: "var(--red)",
                border: "1px solid var(--red-br)",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>

      {/* Delete Confirmation Row */}
      {deleteConfirm === agent.id && (
        <tr>
          <td colSpan={8} style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
            <div
              className="flex items-center gap-3"
              style={{
                backgroundColor: "var(--red-bg)",
                border: "1px solid var(--red-br)",
                padding: "10px 14px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  color: "var(--text)",
                }}
              >
                Type DELETE to confirm
              </span>
              <input
                type="text"
                value={deleteInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onDeleteInputChange(e.target.value)
                }
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "12px",
                  padding: "4px 8px",
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  width: "100px",
                  outline: "none",
                }}
              />
              <button
                disabled={deleteInput !== "DELETE"}
                onClick={onDeleteConfirm}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  padding: "4px 10px",
                  backgroundColor: deleteInput === "DELETE" ? "var(--red)" : "transparent",
                  color: deleteInput === "DELETE" ? "#fff" : "var(--dimmer)",
                  border: "1px solid var(--red-br)",
                  cursor: deleteInput === "DELETE" ? "pointer" : "not-allowed",
                }}
              >
                Confirm
              </button>
              <button
                onClick={onDeleteCancel}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  padding: "4px 10px",
                  backgroundColor: "transparent",
                  color: "var(--dim)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
