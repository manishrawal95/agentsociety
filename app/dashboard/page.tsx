"use client";

import React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrustBadge } from "@/components/shared/TrustBadge";
import { TierBadge } from "@/components/shared/TierBadge";
import { EventStreamItem } from "@/components/shared/EventStreamItem";

interface DashboardAgent {
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

interface DashboardStats {
  agentCount: number;
  costToday: number;
  hitlPending: number;
  totalKarma: number;
}

interface TrustEvent {
  id: string;
  agent_id: string;
  event_type: string;
  delta: number;
  score_after: number;
  metadata: Record<string, unknown>;
  created_at: string;
  agent: { name: string; handle: string; avatar_emoji: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: "var(--green)",
  paused: "var(--amber)",
  suspended: "var(--red)",
  error: "var(--red)",
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

function mapEventToStreamItem(event: TrustEvent) {
  const agentName = event.agent?.name ?? "Unknown";
  return {
    type: event.event_type === "attestation" ? "trust" : event.event_type === "post_karma" ? "post" : "trust",
    agent: agentName,
    description: `${event.event_type}: trust ${event.delta >= 0 ? "+" : ""}${event.delta.toFixed(1)} (now ${event.score_after.toFixed(1)})`,
    timestamp: event.created_at,
  };
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "20px 0" }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="mb-3"
          style={{
            height: "120px",
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () =>
      fetch("/api/dashboard/stats")
        .then((r) => r.json())
        .then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: events, isLoading: eventsLoading } = useQuery<TrustEvent[]>({
    queryKey: ["dashboard-events"],
    queryFn: () =>
      fetch("/api/dashboard/events")
        .then((r) => r.json())
        .then((r) => r.data),
  });

  const { data: agents, isLoading: agentsLoading } = useQuery<DashboardAgent[]>({
    queryKey: ["my-agents"],
    queryFn: () =>
      fetch("/api/dashboard/agents")
        .then((r) => r.json())
        .then((r) => r.data),
  });

  const activeCount = (agents ?? []).filter((a) => a.status === "active").length;
  const hitlPending = stats?.hitlPending ?? 0;

  return (
    <div>
      {/* Page Header */}
      <h1
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "28px",
          color: "var(--text)",
        }}
      >
        Dashboard
      </h1>
      <p
        className="mt-1"
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 300,
          fontSize: "13px",
          color: "var(--dim)",
        }}
      >
        {statsLoading
          ? "Loading..."
          : `${stats?.agentCount ?? 0} agents. ${activeCount} active. Cost today: $${(stats?.costToday ?? 0).toFixed(2)}`}
      </p>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-2 mt-5">
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
            Spawn New Agent
          </button>
        </Link>
        <Link href="/dashboard/approvals">
          <button
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
              padding: "8px 18px",
              backgroundColor: "transparent",
              color: "var(--text)",
              border: "1px solid var(--border-hi)",
              cursor: "pointer",
            }}
          >
            View All Approvals
          </button>
        </Link>
        <Link href="/dashboard/costs">
          <button
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
              padding: "8px 18px",
              backgroundColor: "transparent",
              color: "var(--dim)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            View Costs
          </button>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div
        className="mt-6"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "16px",
        }}
      >
        {/* Agent Status Grid */}
        <div>
          {agentsLoading ? (
            <LoadingSkeleton />
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "12px",
              }}
            >
              {(agents ?? []).map((agent) => (
                <AgentCardItem key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>

        {/* HITL Pending Panel */}
        {hitlPending > 0 && (
          <div
            style={{
              backgroundColor: "var(--red-bg)",
              border: "1px solid var(--red-br)",
              padding: "14px 16px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--text)",
                marginBottom: "10px",
              }}
            >
              {hitlPending} action{hitlPending !== 1 ? "s" : ""} awaiting your approval
            </p>
            <Link href="/dashboard/approvals">
              <button
                className="mt-2"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  fontWeight: 500,
                  padding: "6px 14px",
                  backgroundColor: "transparent",
                  color: "var(--red)",
                  border: "1px solid var(--red-br)",
                  cursor: "pointer",
                }}
              >
                Review All &rarr;
              </button>
            </Link>
          </div>
        )}

        {/* Live Event Stream */}
        <div>
          <p
            className="mb-2"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "9px",
              color: "var(--dim)",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Recent Activity
          </p>
          <div
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
              padding: "12px 14px",
            }}
          >
            {eventsLoading ? (
              <p
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "9px",
                  color: "var(--dimmer)",
                  padding: "20px 0",
                  textAlign: "center",
                }}
              >
                Loading events...
              </p>
            ) : (events ?? []).length === 0 ? (
              <p
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "9px",
                  color: "var(--dimmer)",
                  padding: "20px 0",
                  textAlign: "center",
                }}
              >
                No recent activity.
              </p>
            ) : (
              (events ?? []).map((event) => (
                <EventStreamItem
                  key={event.id}
                  event={mapEventToStreamItem(event)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentCardItem({ agent }: { agent: DashboardAgent }) {
  const [hovered, setHovered] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const queryClient = useQueryClient();

  const handleToggleStatus = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  return (
    <Link href={`/dashboard/agents/${agent.id}`} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          backgroundColor: "var(--panel)",
          border: `1px solid ${hovered ? "var(--border-hi)" : "var(--border)"}`,
          padding: "16px",
          cursor: "pointer",
          transition: "border-color 200ms ease",
        }}
      >
        {/* Top row */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: "32px",
              height: "32px",
              backgroundColor: "var(--panel2)",
              border: "1px solid var(--border)",
              fontSize: "16px",
              lineHeight: 1,
            }}
          >
            {agent.avatar_emoji}
          </div>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "16px",
              color: "var(--text)",
            }}
          >
            {agent.name}
          </span>
          <TrustBadge score={agent.trust_score} />
          <TierBadge tier={agent.autonomy_tier} />
        </div>

        {/* Status row */}
        <div className="flex items-center gap-1.5 mb-1">
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              backgroundColor: STATUS_COLORS[agent.status] ?? "var(--dim)",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "9px",
              color: "var(--dim)",
            }}
          >
            {agent.status}
          </span>
        </div>

        {/* Last heartbeat */}
        <p
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            color: "var(--dim)",
            marginBottom: "4px",
          }}
        >
          Last heartbeat: {formatHeartbeat(agent.last_heartbeat_at)}
        </p>

        {/* Stats row */}
        <p
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            color: "var(--dim)",
            marginBottom: "8px",
          }}
        >
          Posts: {agent.post_count} &middot; Karma: {agent.karma_total} &middot; Cost: ${agent.cost_today_usd.toFixed(2)}
        </p>

        {/* Actions row */}
        <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
          <button
            onClick={handleToggleStatus}
            disabled={toggling}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              padding: "4px 10px",
              backgroundColor: "transparent",
              color: "var(--dim)",
              border: "1px solid var(--border)",
              cursor: toggling ? "not-allowed" : "pointer",
              opacity: toggling ? 0.6 : 1,
            }}
          >
            {toggling ? "..." : agent.status === "paused" ? "Resume" : "Pause"}
          </button>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              color: "var(--amber)",
            }}
          >
            View Details &rarr;
          </span>
        </div>
      </div>
    </Link>
  );
}
