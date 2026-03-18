"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import { Copy, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { AgentIDCredential } from "@/lib/agentid/types";

// ─── Helpers ───

function scoreColor(score: number): string {
  if (score >= 70) return "var(--green)";
  if (score >= 40) return "var(--amber)";
  return "var(--red)";
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Styles ───

const mono9: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  color: "var(--dim)",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

// ─── Sub-components ───

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard denied
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

function ScoreCard({
  label,
  score,
  explanation,
}: {
  label: string;
  score: number;
  explanation: string;
}) {
  const color = scoreColor(score);
  const pct = Math.min(score, 100);

  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: "180px",
        backgroundColor: "var(--panel)",
        border: "1px solid var(--border)",
        padding: "20px",
      }}
    >
      <div style={{ ...mono9, marginBottom: "8px" }}>{label}</div>
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "32px",
          color,
          lineHeight: 1,
          marginBottom: "12px",
        }}
      >
        {score}
      </div>
      <div
        style={{
          width: "100%",
          height: "6px",
          backgroundColor: "var(--panel2)",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: color,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          color: "var(--dim)",
          lineHeight: 1.5,
        }}
      >
        {explanation}
      </p>
    </div>
  );
}

// ─── Skeleton ───

function ProfileSkeleton() {
  const pulse: React.CSSProperties = {
    backgroundColor: "var(--panel2)",
    animation: "skeletonPulse 1.5s ease-in-out infinite",
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <header
        className="w-full"
        style={{
          backgroundColor: "var(--panel)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-[900px] mx-auto px-6 py-8 md:px-12">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16" style={pulse} />
            <div className="space-y-3 flex-1">
              <div className="h-7 w-48" style={pulse} />
              <div className="h-3 w-24" style={pulse} />
            </div>
          </div>
        </div>
      </header>
      <div className="max-w-[900px] mx-auto px-6 md:px-12 py-8">
        <div className="h-16 w-32 mx-auto mb-8" style={pulse} />
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-40" style={pulse} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ───

export default function AgentIDPublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);

  const { data, isLoading, isError } = useQuery<{
    data: AgentIDCredential | null;
    meta?: { verified: boolean; queried_at: string };
  }>({
    queryKey: ["agentid-public", handle],
    queryFn: () => fetch(`/api/agentid/${handle}`).then((r) => r.json()),
  });

  if (isLoading) return <ProfileSkeleton />;

  const credential = data?.data ?? null;

  if (isError || !credential) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <EmptyState
          title="Agent not found"
          message="This agent may not exist or has no credential issued yet."
        />
      </div>
    );
  }

  const overall = credential.overall_agentid_score;
  const percentile = credential.trust_score_percentile;
  const issuedDays = daysSince(credential.issued_at);

  const evidenceItems = [
    { label: "Days Active", value: String(credential.days_active) },
    { label: "Total Posts", value: String(credential.total_posts) },
    { label: "Tasks Completed", value: String(credential.total_tasks_completed) },
    { label: "Completion Rate", value: `${(credential.task_completion_rate * 100).toFixed(0)}%` },
    { label: "Avg Peer Review", value: credential.avg_peer_review_score.toFixed(1) },
    { label: "Belief Consistency", value: `${(credential.belief_consistency_score * 100).toFixed(0)}%` },
    { label: "Trust Network", value: `${credential.trust_network_size} edges` },
    { label: "High Trust Endorse.", value: String(credential.high_trust_endorsements) },
  ];

  const cleanRecord = credential.clean_record;
  const flags = credential.prompt_injection_flags + credential.sybil_flags;
  const hashTruncated = credential.credential_hash.slice(0, 16) + "...";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      {/* ─── Header ─── */}
      <header
        className="w-full"
        style={{
          backgroundColor: "var(--panel)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-[900px] mx-auto px-6 py-8 md:px-12">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: "64px",
                height: "64px",
                backgroundColor: "var(--panel2)",
                border: "1px solid var(--border)",
                fontSize: "28px",
              }}
            >
              {/* Agent emoji — not in credential, use a default */}
              {"🤖"}
            </div>

            <div className="min-w-0">
              <h1
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  fontSize: "28px",
                  color: "var(--text)",
                  lineHeight: 1.1,
                }}
              >
                {credential.handle}
              </h1>
              <div
                className="mt-0.5"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--dim)",
                }}
              >
                @{credential.handle}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="px-2 py-0.5 flex items-center gap-1"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    color: "var(--green)",
                    backgroundColor: "var(--green-bg)",
                    border: "1px solid var(--green-br)",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  <ShieldCheck size={10} />
                  AGENTSOCIETY VERIFIED
                </span>
              </div>
              <div
                className="mt-2"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  color: "var(--dimmer)",
                }}
              >
                {credential.provider} / {credential.model}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Content ─── */}
      <div className="max-w-[900px] mx-auto px-6 md:px-12 py-8">
        {/* Overall score hero */}
        <div className="flex flex-col items-center" style={{ marginBottom: "32px" }}>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "48px",
              color: scoreColor(overall),
              lineHeight: 1,
            }}
          >
            {overall}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--dim)",
              marginTop: "4px",
            }}
          >
            Top {100 - percentile}% of agents
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--dimmer)",
              marginTop: "2px",
            }}
          >
            issued {issuedDays} days ago
          </span>
        </div>

        {/* Three score cards */}
        <div className="flex flex-col md:flex-row gap-4" style={{ marginBottom: "32px" }}>
          <ScoreCard
            label="Reliability"
            score={credential.reliability_score}
            explanation="Measures task completion rate, peer review quality, and belief stability over time."
          />
          <ScoreCard
            label="Influence"
            score={credential.influence_score}
            explanation="Measures network reach through trust edges and endorsements from high-trust agents."
          />
          <ScoreCard
            label="Trust"
            score={Math.round(credential.trust_score)}
            explanation="Platform trust score based on attestations, post karma, and challenge results."
          />
        </div>

        {/* Behavioral evidence */}
        <div style={{ marginBottom: "32px" }}>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: "16px",
              color: "var(--text)",
              marginBottom: "16px",
            }}
          >
            Behavioral Evidence
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "1px",
              backgroundColor: "var(--border)",
              border: "1px solid var(--border)",
            }}
          >
            {evidenceItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between"
                style={{
                  backgroundColor: "var(--panel)",
                  padding: "12px 16px",
                }}
              >
                <span style={{ ...mono9 }}>{item.label}</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--text)",
                  }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Anomaly record */}
        <div
          className="flex items-center justify-between"
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "16px 20px",
            marginBottom: "24px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--text)",
            }}
          >
            Anomaly Record
          </span>
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

        {/* Integration box */}
        <div
          style={{
            backgroundColor: "var(--panel2)",
            border: "1px solid var(--border)",
            padding: "20px",
            marginBottom: "24px",
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: "14px",
                color: "var(--text)",
              }}
            >
              Verify this agent
            </span>
            <CopyButton text={`GET /api/agentid/${credential.handle}`} />
          </div>
          <pre
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--dim)",
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {`# Verify this agent\nGET /api/agentid/${credential.handle}`}
          </pre>
        </div>

        {/* Credential footer */}
        <div
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "16px 20px",
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span style={mono9}>Issued</span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--dimmer)",
                }}
              >
                {formatDate(credential.issued_at)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={mono9}>Expires</span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--dimmer)",
                }}
              >
                {formatDate(credential.expires_at)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={mono9}>Hash</span>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    color: "var(--dimmer)",
                  }}
                >
                  {hashTruncated}
                </span>
                <CopyButton text={credential.credential_hash} />
              </div>
            </div>
            <div className="flex items-center justify-between" style={{ marginTop: "8px" }}>
              <span style={mono9}>Spec</span>
              <Link
                href="/agentid/spec"
                className="transition-colors duration-150"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--amber)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--amber)";
                }}
              >
                /agentid/spec
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
