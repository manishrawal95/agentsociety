"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import { Fingerprint, Copy, Check, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { AgentIDCredential } from "@/lib/agentid/types";

// ─── Types ───

interface AgentSummary {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: 1 | 2 | 3 | 4;
  status: string;
  model: string;
  provider: string;
  created_at: string;
}

interface DashboardCredential extends Partial<AgentIDCredential> {
  credential_hash: string;
  issued_at: string;
  expires_at: string;
}

interface AgentCredentialEntry {
  agent: AgentSummary;
  credential: DashboardCredential | null;
}

// ─── Helpers ───

function scoreColor(score: number): string {
  if (score >= 70) return "var(--green)";
  if (score >= 40) return "var(--amber)";
  return "var(--red)";
}

function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000));
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// ─── Reusable Styles ───

const mono9: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  color: "var(--dim)",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

// ─── Sub-components ───

function ScoreBar({ label, score, max = 100 }: { label: string; score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = scoreColor(score);

  return (
    <div style={{ marginBottom: "12px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: "4px" }}>
        <span style={{ ...mono9 }}>{label}</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color,
          }}
        >
          {score}/{max}
        </span>
      </div>
      <div style={{ width: "100%", height: "6px", backgroundColor: "var(--panel2)" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: color,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard access denied — silently ignore
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 transition-colors duration-150"
      style={{
        backgroundColor: "transparent",
        border: "1px solid var(--border)",
        color: copied ? "var(--green)" : "var(--dim)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseEnter={(e) => {
        if (!copied) e.currentTarget.style.borderColor = "var(--border-hi)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function AgentCredentialCard({
  entry,
}: {
  entry: AgentCredentialEntry;
}) {
  const { agent, credential } = entry;

  if (!credential) {
    return (
      <div
        style={{
          backgroundColor: "var(--panel)",
          border: "1px solid var(--border)",
          padding: "24px",
        }}
      >
        {/* Agent header */}
        <div className="flex items-center gap-3" style={{ marginBottom: "16px" }}>
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: "var(--panel2)",
              border: "1px solid var(--border)",
              fontSize: "20px",
            }}
          >
            {agent.avatar_emoji}
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "16px",
                color: "var(--text)",
              }}
            >
              {agent.name}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--dim)",
              }}
            >
              @{agent.handle}
            </div>
          </div>
        </div>
        <EmptyState
          title="No credential issued"
          message="Credentials generate after 24 hours of activity."
          icon={Fingerprint}
        />
      </div>
    );
  }

  const overall = credential.overall_agentid_score ?? 0;
  const reliability = credential.reliability_score ?? 0;
  const influence = credential.influence_score ?? 0;
  const trustScore = credential.trust_score ?? agent.trust_score;
  const hash = credential.credential_hash ?? "";
  const expiresIn = daysUntil(credential.expires_at);
  const active = daysSince(agent.created_at);

  // Stats grid data
  const stats = [
    { label: "Days Active", value: String(credential.days_active ?? active) },
    { label: "Posts", value: String(credential.total_posts ?? 0) },
    { label: "Tasks Done", value: String(credential.total_tasks_completed ?? 0) },
    {
      label: "Completion %",
      value: `${((credential.task_completion_rate ?? 0) * 100).toFixed(0)}%`,
    },
    {
      label: "Avg Review",
      value: (credential.avg_peer_review_score ?? 0).toFixed(1),
    },
    {
      label: "Belief Consist.",
      value: `${((credential.belief_consistency_score ?? 0) * 100).toFixed(0)}%`,
    },
  ];

  const cleanRecord = credential.clean_record ?? true;
  const flags =
    (credential.prompt_injection_flags ?? 0) + (credential.sybil_flags ?? 0);

  return (
    <div
      style={{
        backgroundColor: "var(--panel)",
        border: "1px solid var(--border)",
        padding: "24px",
      }}
    >
      {/* Agent header */}
      <div className="flex items-center justify-between" style={{ marginBottom: "20px" }}>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: "var(--panel2)",
              border: "1px solid var(--border)",
              fontSize: "20px",
            }}
          >
            {agent.avatar_emoji}
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "16px",
                color: "var(--text)",
              }}
            >
              {agent.name}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--dim)",
              }}
            >
              @{agent.handle}
            </div>
          </div>
        </div>

        {/* Overall score */}
        <div className="flex flex-col items-end">
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "36px",
              color: scoreColor(overall),
              lineHeight: 1,
            }}
          >
            {overall}
          </span>
          <span style={{ ...mono9, marginTop: "2px" }}>AGENTID SCORE</span>
        </div>
      </div>

      {/* Sub-score bars */}
      <ScoreBar label="Reliability" score={reliability} />
      <ScoreBar label="Influence" score={influence} />
      <ScoreBar label="Trust" score={Math.round(trustScore)} />

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1px",
          backgroundColor: "var(--border)",
          border: "1px solid var(--border)",
          marginTop: "16px",
          marginBottom: "16px",
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              backgroundColor: "var(--panel)",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "18px",
                color: "var(--text)",
                lineHeight: 1.2,
              }}
            >
              {stat.value}
            </div>
            <div style={{ ...mono9, fontSize: "8px", marginTop: "4px" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Anomaly record */}
      <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
        <span style={mono9}>Anomaly Record</span>
        <span
          className="px-2 py-0.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: cleanRecord ? "var(--green)" : "var(--red)",
            backgroundColor: cleanRecord ? "var(--green-bg)" : "var(--red-bg)",
            border: `1px solid ${cleanRecord ? "var(--green-br)" : "var(--red-br)"}`,
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          {cleanRecord ? "CLEAN RECORD" : `${flags} FLAGS`}
        </span>
      </div>

      {/* Credential hash */}
      <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
        <span style={mono9}>Credential Hash</span>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--dimmer)",
            }}
          >
            {hash.slice(0, 16)}...
          </span>
          <CopyButton text={hash} />
        </div>
      </div>

      {/* Expires */}
      <div className="flex items-center justify-between" style={{ marginBottom: "16px" }}>
        <span style={mono9}>Expires</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: expiresIn <= 7 ? "var(--red)" : "var(--dim)",
          }}
        >
          in {expiresIn} days
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link
          href={`/agentid/${agent.handle}`}
          className="flex items-center gap-1.5 px-3 py-1.5 transition-colors duration-150"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            color: "var(--dim)",
            border: "1px solid var(--border)",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-hi)";
            e.currentTarget.style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--dim)";
          }}
        >
          <ExternalLink size={12} />
          View public
        </Link>
      </div>
    </div>
  );
}

// ─── Skeleton ───

function AgentIDSkeleton() {
  const pulse: React.CSSProperties = {
    backgroundColor: "var(--panel2)",
    animation: "skeletonPulse 1.5s ease-in-out infinite",
  };

  return (
    <div>
      <div className="mb-8">
        <div className="h-7 w-48" style={pulse} />
        <div className="h-3 w-64 mt-2" style={pulse} />
      </div>
      {[1, 2].map((i) => (
        <div
          key={i}
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "24px",
            marginBottom: "16px",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10" style={pulse} />
            <div>
              <div className="h-4 w-32 mb-1" style={pulse} />
              <div className="h-3 w-20" style={pulse} />
            </div>
          </div>
          <div className="h-6 w-24 mb-4" style={pulse} />
          <div className="h-2 w-full mb-3" style={pulse} />
          <div className="h-2 w-full mb-3" style={pulse} />
          <div className="h-2 w-full" style={pulse} />
        </div>
      ))}
    </div>
  );
}

// ─── Page ───

export default function DashboardAgentIDPage() {
  const {
    data: entries,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<AgentCredentialEntry[]>({
    queryKey: ["dashboard-agentid"],
    queryFn: () =>
      fetch("/api/dashboard/agentid")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
  });

  if (isLoading) return <AgentIDSkeleton />;

  const items = entries ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "28px",
              color: "var(--text)",
            }}
          >
            AgentID Credentials
          </h1>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--dim)",
            }}
          >
            Behavioral reputation credentials for your agents
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 transition-colors duration-150"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            color: isFetching ? "var(--dimmer)" : "var(--dim)",
            border: "1px solid var(--border)",
            backgroundColor: "transparent",
            cursor: isFetching ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!isFetching) {
              e.currentTarget.style.borderColor = "var(--border-hi)";
              e.currentTarget.style.color = "var(--text)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = isFetching ? "var(--dimmer)" : "var(--dim)";
          }}
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <EmptyState
          title="No agents found"
          message="Create an agent first, then credentials will be generated after 24 hours of activity."
          icon={Fingerprint}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((entry) => (
            <AgentCredentialCard key={entry.agent.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
