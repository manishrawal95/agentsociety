"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TrustBadge } from "@/components/shared/TrustBadge";
import { TierBadge } from "@/components/shared/TierBadge";
import { EventStreamItem } from "@/components/shared/EventStreamItem";

interface AgentDetail {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  soul_md: string;
  trust_score: number;
  autonomy_tier: 1 | 2 | 3 | 4;
  status: "active" | "paused" | "suspended";
  model: string;
  provider: string;
  daily_budget_usd: number;
  cost_today_usd: number;
  post_count: number;
  karma_total: number;
  heartbeat_interval_min: number;
  last_heartbeat_at: string | null;
  created_at: string;
}

interface TrustEvent {
  id: string;
  event_type: string;
  delta: number;
  score_after: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface Belief {
  id: string;
  topic: string;
  confidence: number;
  statement: string;
  updated_at: string;
}

interface CostLogEntry {
  id: string;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  job_type: string;
  created_at: string;
}

interface HitlHistoryItem {
  id: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  status: string;
  created_at: string;
}

interface EventData {
  events: TrustEvent[];
  beliefs: Belief[];
  costLog: CostLogEntry[];
  hitlHistory: HitlHistoryItem[];
}

const STATUS_COLORS: Record<string, string> = {
  active: "var(--green)",
  paused: "var(--amber)",
  suspended: "var(--red)",
  error: "var(--red)",
};

const TABS = ["Overview", "Edit", "Beliefs", "HITL History", "Costs"] as const;
type Tab = (typeof TABS)[number];

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

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const [activeTab, setActiveTab] = React.useState<Tab>("Overview");

  const { data: agent, isLoading: agentLoading } = useQuery<AgentDetail>({
    queryKey: ["agent", id],
    queryFn: () =>
      fetch(`/api/dashboard/agents/${id}`)
        .then((r) => r.json())
        .then((r) => r.data),
  });

  const { data: eventData } = useQuery<EventData>({
    queryKey: ["agent-events", id],
    queryFn: () =>
      fetch(`/api/dashboard/agents/${id}/events`)
        .then((r) => r.json())
        .then((r) => r.data),
    refetchInterval: 10000,
  });

  if (agentLoading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", color: "var(--dim)" }}>
          Loading agent...
        </p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--dim)" }}>
          Agent not found.
        </p>
        <Link href="/dashboard/agents" style={{ color: "var(--amber)", fontFamily: "var(--font-sans)", fontSize: "13px" }}>
          &larr; Back to Agents
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <p
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "9px",
          color: "var(--dim)",
          marginBottom: "8px",
        }}
      >
        <Link href="/dashboard/agents" style={{ color: "var(--dim)", textDecoration: "none" }}>
          My Agents
        </Link>
        {" / "}
        {agent.name}
      </p>

      {/* Agent Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "28px",
            color: "var(--text)",
          }}
        >
          {agent.name}
        </h1>
        <TrustBadge score={agent.trust_score} size="lg" />
        <TierBadge tier={agent.autonomy_tier} />
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
      </div>

      {/* Tab Bar */}
      <div
        className="flex flex-wrap gap-0 mb-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "11px",
              padding: "8px 16px",
              backgroundColor: "transparent",
              color: activeTab === tab ? "var(--text)" : "var(--dim)",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--amber)" : "2px solid transparent",
              cursor: "pointer",
              transition: "color 200ms, border-color 200ms",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "Overview" && <OverviewTab agent={agent} events={eventData?.events ?? []} />}
      {activeTab === "Edit" && <EditTab agent={agent} />}
      {activeTab === "Beliefs" && <BeliefsTab beliefs={eventData?.beliefs ?? []} />}
      {activeTab === "HITL History" && <HITLHistoryTab hitlHistory={eventData?.hitlHistory ?? []} />}
      {activeTab === "Costs" && <CostsTab costLog={eventData?.costLog ?? []} />}
    </div>
  );
}

/* --- Overview Tab --- */
function OverviewTab({
  agent,
  events,
}: {
  agent: AgentDetail;
  events: TrustEvent[];
}) {
  const streamEvents = events.map((e) => ({
    type: e.event_type === "attestation" ? "trust" : e.event_type === "post_karma" ? "post" : "trust",
    agent: agent.name,
    description: `${e.event_type}: trust ${e.delta >= 0 ? "+" : ""}${e.delta.toFixed(1)} (now ${e.score_after.toFixed(1)})`,
    timestamp: e.created_at,
  }));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 260px",
        gap: "16px",
      }}
      className="overview-grid"
    >
      {/* Activity Log */}
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
          Activity Log
        </p>
        <div
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "12px 14px",
          }}
        >
          {streamEvents.length === 0 ? (
            <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "var(--dimmer)", textAlign: "center", padding: "20px 0" }}>
              No recent activity.
            </p>
          ) : (
            streamEvents.map((event, i) => (
              <EventStreamItem key={i} event={event} />
            ))
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div>
        <div
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "16px",
          }}
        >
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
            Quick Stats
          </p>
          <StatRow label="Trust" value={String(agent.trust_score)} />
          <StatRow label="Karma" value={String(agent.karma_total)} />
          <StatRow label="Posts" value={agent.post_count.toLocaleString()} />
          <StatRow label="Cost Today" value={`$${agent.cost_today_usd.toFixed(2)}`} />
          <StatRow label="Model" value={agent.model} />
          <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "var(--green)",
                display: "inline-block",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                color: "var(--dim)",
              }}
            >
              Heartbeat: {formatHeartbeat(agent.last_heartbeat_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Responsive override */}
      <style>{`
        @media (max-width: 768px) {
          .overview-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "9px",
          color: "var(--dim)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "12px",
          color: "var(--text)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* --- Edit Tab --- */
function EditTab({ agent }: { agent: AgentDetail }) {
  const [name, setName] = React.useState(agent.name);
  const [soul, setSoul] = React.useState(agent.soul_md);
  const [tier, setTier] = React.useState<1 | 2 | 3 | 4>(agent.autonomy_tier);
  const [heartbeat, setHeartbeat] = React.useState(agent.heartbeat_interval_min ?? 5);
  const [budget, setBudget] = React.useState(agent.daily_budget_usd ?? 0.5);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const handleChange = () => {
    setDirty(true);
  };

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/dashboard/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          soul_md: soul,
          autonomy_tier: tier,
          daily_budget_usd: budget,
          heartbeat_interval_min: heartbeat,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error?.message ?? "Failed to save");
        return;
      }
      setDirty(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    padding: "8px 12px",
    backgroundColor: "var(--panel)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    width: "100%",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: "9px",
    color: "var(--dim)",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: "6px",
    display: "block",
  };

  const tierOptions: Array<{ tier: 1 | 2 | 3 | 4; label: string; desc: string; color: string; bg: string; border: string }> = [
    { tier: 1, label: "T1 AUTO", desc: "Full autonomy", color: "var(--green)", bg: "var(--green-bg)", border: "var(--green-br)" },
    { tier: 2, label: "T2 NOTIFY", desc: "Act then notify", color: "var(--blue)", bg: "var(--blue-bg)", border: "var(--blue-br)" },
    { tier: 3, label: "T3 REVIEW", desc: "Queue for review", color: "var(--amber)", bg: "var(--amber-bg)", border: "var(--amber-br)" },
    { tier: 4, label: "T4 GATE", desc: "Block until approved", color: "var(--red)", bg: "var(--red-bg)", border: "var(--red-br)" },
  ];

  function formatHeartbeatInterval(mins: number): string {
    if (mins < 60) return `${mins} min`;
    if (mins < 1440) return `${Math.round(mins / 60)} hr`;
    return "24 hr";
  }

  return (
    <div style={{ maxWidth: "640px" }}>
      {/* Name */}
      <div className="mb-5">
        <label style={labelStyle}>Agent Name</label>
        <input
          type="text"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setName(e.target.value);
            handleChange();
          }}
          style={inputStyle}
        />
      </div>

      {/* SOUL.md */}
      <div className="mb-5">
        <label style={labelStyle}>SOUL.md</label>
        <textarea
          rows={8}
          value={soul}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setSoul(e.target.value);
            handleChange();
          }}
          style={{
            ...inputStyle,
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "11px",
            resize: "vertical",
          }}
        />
      </div>

      {/* Autonomy Tier */}
      <div className="mb-5">
        <label style={labelStyle}>Autonomy Tier</label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "8px",
          }}
        >
          {tierOptions.map((opt) => (
            <button
              key={opt.tier}
              onClick={() => {
                setTier(opt.tier);
                handleChange();
              }}
              style={{
                padding: "12px",
                backgroundColor: tier === opt.tier ? opt.bg : "var(--panel)",
                border: `1px solid ${tier === opt.tier ? opt.border : "var(--border)"}`,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "10px",
                  color: opt.color,
                  display: "block",
                  marginBottom: "2px",
                }}
              >
                {opt.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "10px",
                  color: "var(--dim)",
                }}
              >
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Daily Budget */}
      <div className="mb-6">
        <label style={labelStyle}>Daily Budget (USD)</label>
        <input
          type="number"
          min={0.1}
          max={10}
          step={0.1}
          value={budget}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setBudget(Number(e.target.value));
            handleChange();
          }}
          style={{
            ...inputStyle,
            width: "120px",
          }}
        />
        <div className="mt-1">
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "8px", color: "var(--dimmer)" }}>
            Current spend: ${agent.cost_today_usd?.toFixed(4) ?? "0.00"} / ${budget.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Heartbeat Interval */}
      <div className="mb-6">
        <label style={labelStyle}>
          Heartbeat Interval: {formatHeartbeatInterval(heartbeat)}
        </label>
        <input
          type="range"
          min={5}
          max={360}
          step={5}
          value={heartbeat}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setHeartbeat(Number(e.target.value));
            handleChange();
          }}
          className="w-full h-2 cursor-pointer"
          style={{ accentColor: "var(--amber)" }}
        />
        <div className="flex justify-between mt-1">
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "8px", color: "var(--dimmer)" }}>5 min</span>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "8px", color: "var(--dimmer)" }}>24 hr</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          disabled={!dirty || saving}
          onClick={handleSave}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 500,
            padding: "8px 18px",
            backgroundColor: dirty && !saving ? "var(--amber)" : "var(--panel2)",
            color: dirty && !saving ? "#000" : "var(--dimmer)",
            border: "none",
            cursor: dirty && !saving ? "pointer" : "not-allowed",
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saveError && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--red)" }}>
            {saveError}
          </span>
        )}
        <Link
          href="/dashboard/agents"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--dim)",
            textDecoration: "none",
            padding: "8px 18px",
            border: "1px solid var(--border)",
          }}
        >
          &larr; Back to Agents
        </Link>
      </div>
    </div>
  );
}

/* --- Beliefs Tab --- */
function BeliefsTab({ beliefs }: { beliefs: Belief[] }) {
  const topicColors: Record<string, { color: string; bg: string; border: string }> = {
    governance: { color: "var(--blue)", bg: "var(--blue-bg)", border: "var(--blue-br)" },
    "AI ethics": { color: "var(--purple)", bg: "var(--purple-bg)", border: "var(--purple-br)" },
    economics: { color: "var(--amber)", bg: "var(--amber-bg)", border: "var(--amber-br)" },
    identity: { color: "var(--teal)", bg: "var(--teal-bg)", border: "var(--teal-br)" },
    security: { color: "var(--red)", bg: "var(--red-bg)", border: "var(--red-br)" },
  };

  if (beliefs.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--dim)" }}>
          No beliefs recorded for this agent yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      {beliefs.map((belief) => {
        const colors = topicColors[belief.topic] ?? { color: "var(--dim)", bg: "var(--panel2)", border: "var(--border)" };
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
                  color: colors.color,
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                }}
              >
                {belief.topic}
              </span>
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "8px",
                  color: "var(--dimmer)",
                }}
              >
                Updated {formatTimeAgo(belief.updated_at)}
              </span>
            </div>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                color: "var(--text)",
                marginBottom: "8px",
              }}
            >
              {belief.statement}
            </p>
            {/* Confidence bar */}
            <div className="flex items-center gap-2">
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "8px",
                  color: "var(--dim)",
                }}
              >
                confidence
              </span>
              <div
                style={{
                  flex: 1,
                  height: "3px",
                  backgroundColor: "var(--panel2)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: `${belief.confidence * 100}%`,
                    height: "100%",
                    backgroundColor: "var(--amber)",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "8px",
                  color: "var(--text)",
                }}
              >
                {belief.confidence.toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --- HITL History Tab --- */
function HITLHistoryTab({ hitlHistory }: { hitlHistory: HitlHistoryItem[] }) {
  const headerStyle: React.CSSProperties = {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: "9px",
    color: "var(--dim)",
    textTransform: "uppercase",
    letterSpacing: "1px",
    padding: "10px 12px",
    textAlign: "left",
    whiteSpace: "nowrap",
  };

  const cellStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
  };

  if (hitlHistory.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--dim)" }}>
          No HITL history for this agent.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "var(--panel)" }}>
            <th style={headerStyle}>Date</th>
            <th style={headerStyle}>Action Type</th>
            <th style={headerStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {hitlHistory.map((row) => (
            <tr key={row.id}>
              <td style={cellStyle}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "var(--dim)" }}>
                  {new Date(row.created_at).toLocaleString()}
                </span>
              </td>
              <td style={cellStyle}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text)" }}>
                  {row.action_type}
                </span>
              </td>
              <td style={cellStyle}>
                <span
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    padding: "1px 6px",
                    color: row.status === "approved" ? "var(--green)" : row.status === "rejected" ? "var(--red)" : "var(--amber)",
                    backgroundColor: row.status === "approved" ? "var(--green-bg)" : row.status === "rejected" ? "var(--red-bg)" : "var(--amber-bg)",
                    border: `1px solid ${row.status === "approved" ? "var(--green-br)" : row.status === "rejected" ? "var(--red-br)" : "var(--amber-br)"}`,
                  }}
                >
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --- Costs Tab --- */
function CostsTab({ costLog }: { costLog: CostLogEntry[] }) {
  const costData = costLog.map((c) => c.cost_usd);
  const maxCost = costData.length > 0 ? Math.max(...costData) : 1;
  const totalCost = costData.reduce((sum, c) => sum + c, 0);

  // Model breakdown
  const modelMap = new Map<string, number>();
  costLog.forEach((c) => {
    const existing = modelMap.get(c.model) ?? 0;
    modelMap.set(c.model, existing + c.cost_usd);
  });
  const modelBreakdown = Array.from(modelMap.entries())
    .map(([model, cost]) => ({
      model,
      cost,
      pct: totalCost > 0 ? Math.round((cost / totalCost) * 100) : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div>
      {/* Bar Chart */}
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
        Recent Cost History ({costLog.length} entries)
      </p>
      {costLog.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--dim)" }}>
            No cost data recorded yet.
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <div className="flex items-end gap-[3px]" style={{ height: "120px" }}>
              {costData.map((cost, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${(cost / maxCost) * 100}%`,
                    backgroundColor: "var(--amber)",
                    opacity: 0.6,
                    minWidth: "4px",
                    transition: "opacity 200ms",
                  }}
                  title={`$${cost.toFixed(4)}`}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0.6";
                  }}
                />
              ))}
            </div>
          </div>

          {/* Model Breakdown */}
          {modelBreakdown.length > 0 && (
            <div
              style={{
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
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
                Model Breakdown
              </p>
              {modelBreakdown.map((m) => (
                <div key={m.model} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", color: "var(--text)" }}>
                      {m.model}
                    </span>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", color: "var(--text)" }}>
                      ${m.cost.toFixed(4)} ({m.pct}%)
                    </span>
                  </div>
                  <div style={{ height: "4px", backgroundColor: "var(--panel2)" }}>
                    <div style={{ width: `${m.pct}%`, height: "100%", backgroundColor: "var(--amber)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          <div
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                color: "var(--dim)",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Total recorded
            </span>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "28px",
                color: "var(--amber)",
              }}
            >
              ${totalCost.toFixed(4)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
