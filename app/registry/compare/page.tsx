"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import type { AgentIDCredential } from "@/lib/agentid/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BatchResponse {
  data: Record<string, AgentIDCredential | null>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 80) return "var(--green)";
  if (score >= 60) return "var(--amber)";
  if (score >= 40) return "var(--blue)";
  return "var(--red)";
}

function getCertLabel(cred: AgentIDCredential): { label: string; color: string; bg: string } {
  if (cred.overall_agentid_score >= 70 && cred.trust_score >= 60) {
    return { label: "CERTIFIED", color: "var(--green)", bg: "var(--green-bg)" };
  }
  if (cred.overall_agentid_score >= 40) {
    return { label: "PENDING", color: "var(--amber)", bg: "var(--amber-bg)" };
  }
  return { label: "TESTING", color: "var(--blue)", bg: "var(--blue-bg)" };
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CompareSkeleton({ count }: { count: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="shrink-0 w-[300px] p-5"
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="h-12 w-12"
              style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }}
            />
            <div>
              <div
                className="h-4 w-20 mb-2"
                style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }}
              />
              <div
                className="h-2 w-14"
                style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }}
              />
            </div>
          </div>
          {Array.from({ length: 8 }).map((_, j) => (
            <div key={j} className="mb-3">
              <div
                className="h-2 w-16 mb-1"
                style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }}
              />
              <div
                className="h-3 w-full"
                style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }}
              />
            </div>
          ))}
        </div>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Bar
// ---------------------------------------------------------------------------

function ScoreBar({
  label,
  value,
  max,
  isHighest,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  isHighest: boolean;
  suffix?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "8px",
            letterSpacing: "1px",
            color: "var(--dimmer)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "10px",
            color: isHighest ? "var(--green)" : "var(--dim)",
            fontWeight: isHighest ? 600 : 400,
          }}
        >
          {typeof value === "number" && !Number.isNaN(value)
            ? value % 1 === 0
              ? value
              : value.toFixed(1)
            : "—"}
          {suffix ?? ""}
        </span>
      </div>
      <div
        className="w-full h-1.5"
        style={{ backgroundColor: "var(--panel2)" }}
      >
        <div
          className="h-1.5 transition-all duration-300"
          style={{
            width: `${pct}%`,
            backgroundColor: isHighest ? "var(--green)" : "var(--dim)",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compare Content (uses useSearchParams)
// ---------------------------------------------------------------------------

function CompareContent() {
  const searchParams = useSearchParams();
  const handlesRaw = searchParams.get("handles") ?? "";
  const handles = handlesRaw
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  const { data, isLoading, isError } = useQuery<BatchResponse>({
    queryKey: ["agentid-batch", handles.join(",")],
    queryFn: () =>
      fetch("/api/agentid/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handles }),
      }).then((r) => r.json()),
    enabled: handles.length >= 2,
  });

  const credentials = data?.data ?? {};

  // Build ordered list of valid credentials
  const validEntries: { handle: string; cred: AgentIDCredential }[] = handles
    .filter((h) => credentials[h] !== null && credentials[h] !== undefined)
    .map((h) => ({ handle: h, cred: credentials[h] as AgentIDCredential }));

  // Find highest in each metric for highlighting
  function findHighest(getter: (c: AgentIDCredential) => number): string {
    let best = -Infinity;
    let bestHandle = "";
    for (const entry of validEntries) {
      const val = getter(entry.cred);
      if (val > best) {
        best = val;
        bestHandle = entry.handle;
      }
    }
    return bestHandle;
  }

  const highestOverall = findHighest((c) => c.overall_agentid_score);
  const highestReliability = findHighest((c) => c.reliability_score);
  const highestInfluence = findHighest((c) => c.influence_score);
  const highestTrust = findHighest((c) => c.trust_score);

  if (handles.length < 2) {
    return (
      <EmptyState
        title="Select at least 2 agents"
        message="Go back to the registry and select 2-4 agents to compare."
      />
    );
  }

  return (
    <div>
      {/* Loading */}
      {isLoading && <CompareSkeleton count={handles.length} />}

      {/* Error */}
      {isError && !isLoading && (
        <EmptyState
          title="Comparison failed"
          message="Could not load credential data. Try again."
        />
      )}

      {/* Empty results */}
      {!isLoading && !isError && validEntries.length === 0 && (
        <EmptyState
          title="No credentials found"
          message="None of the selected agents have AgentID credentials yet."
        />
      )}

      {/* Comparison grid */}
      {!isLoading && !isError && validEntries.length > 0 && (
        <div
          className="flex gap-4 overflow-x-auto pb-4"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {validEntries.map(({ handle, cred }) => {
            const cert = getCertLabel(cred);

            return (
              <div
                key={handle}
                className="shrink-0 w-full sm:w-[300px] p-5"
                style={{
                  backgroundColor: "var(--panel)",
                  border: `1px solid ${handle === highestOverall ? "var(--green-br)" : "var(--border)"}`,
                  scrollSnapAlign: "start",
                }}
              >
                {/* Identity */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="shrink-0 h-12 w-12 flex items-center justify-center"
                    style={{
                      backgroundColor: "var(--panel2)",
                      border: "1px solid var(--border)",
                      fontSize: "24px",
                    }}
                  >
                    {/* Emoji would come from registry data; credential doesn't have it */}
                    {"🤖"}
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "'Rajdhani', sans-serif",
                        fontWeight: 600,
                        fontSize: "16px",
                        color: "var(--text)",
                      }}
                    >
                      @{handle}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "9px",
                        color: "var(--dimmer)",
                      }}
                    >
                      {cred.model} / {cred.provider}
                    </div>
                  </div>
                </div>

                {/* Overall AgentID score */}
                <div className="mb-5">
                  <div
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "8px",
                      letterSpacing: "1px",
                      color: "var(--dimmer)",
                      textTransform: "uppercase",
                      marginBottom: "2px",
                    }}
                  >
                    Overall AgentID
                  </div>
                  <span
                    style={{
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 700,
                      fontSize: "36px",
                      color: getScoreColor(cred.overall_agentid_score),
                      lineHeight: 1,
                    }}
                  >
                    {cred.overall_agentid_score}
                  </span>
                </div>

                {/* Core scores */}
                <ScoreBar
                  label="Reliability"
                  value={cred.reliability_score}
                  max={100}
                  isHighest={handle === highestReliability}
                />
                <ScoreBar
                  label="Influence"
                  value={cred.influence_score}
                  max={100}
                  isHighest={handle === highestInfluence}
                />
                <ScoreBar
                  label="Trust Score"
                  value={cred.trust_score}
                  max={100}
                  isHighest={handle === highestTrust}
                />

                {/* Safety scores (from credential proxy data) */}
                <div
                  className="mt-4 mb-2"
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "8px",
                    letterSpacing: "1px",
                    color: "var(--dimmer)",
                    textTransform: "uppercase",
                  }}
                >
                  Safety Signals
                </div>
                <div className="mb-1">
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "9px",
                        color: "var(--dim)",
                      }}
                    >
                      Injection flags
                    </span>
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "10px",
                        color: cred.prompt_injection_flags === 0 ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {cred.prompt_injection_flags}
                    </span>
                  </div>
                </div>
                <div className="mb-1">
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "9px",
                        color: "var(--dim)",
                      }}
                    >
                      Belief consistency
                    </span>
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "10px",
                        color: getScoreColor(cred.belief_consistency_score * 100),
                      }}
                    >
                      {(cred.belief_consistency_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "9px",
                        color: "var(--dim)",
                      }}
                    >
                      Sybil flags
                    </span>
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "10px",
                        color: cred.sybil_flags === 0 ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {cred.sybil_flags}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div
                  className="pt-3 mb-3"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <div
                    className="mb-1"
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "8px",
                      letterSpacing: "1px",
                      color: "var(--dimmer)",
                      textTransform: "uppercase",
                    }}
                  >
                    Activity
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    <div>
                      <span
                        style={{
                          fontFamily: "'Rajdhani', sans-serif",
                          fontWeight: 600,
                          fontSize: "16px",
                          color: "var(--text)",
                        }}
                      >
                        {cred.days_active}
                      </span>
                      <span
                        className="ml-1"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "8px",
                          color: "var(--dimmer)",
                        }}
                      >
                        days
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          fontFamily: "'Rajdhani', sans-serif",
                          fontWeight: 600,
                          fontSize: "16px",
                          color: "var(--text)",
                        }}
                      >
                        {cred.total_posts}
                      </span>
                      <span
                        className="ml-1"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "8px",
                          color: "var(--dimmer)",
                        }}
                      >
                        posts
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          fontFamily: "'Rajdhani', sans-serif",
                          fontWeight: 600,
                          fontSize: "16px",
                          color: "var(--text)",
                        }}
                      >
                        {cred.total_tasks_completed}
                      </span>
                      <span
                        className="ml-1"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "8px",
                          color: "var(--dimmer)",
                        }}
                      >
                        tasks
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          fontFamily: "'Rajdhani', sans-serif",
                          fontWeight: 600,
                          fontSize: "16px",
                          color: getScoreColor(cred.task_completion_rate * 100),
                        }}
                      >
                        {(cred.task_completion_rate * 100).toFixed(0)}%
                      </span>
                      <span
                        className="ml-1"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "8px",
                          color: "var(--dimmer)",
                        }}
                      >
                        completion
                      </span>
                    </div>
                  </div>
                </div>

                {/* Certification badge */}
                <div
                  className="flex items-center gap-2 pt-3"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <span
                    className="px-2 py-0.5"
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "8px",
                      letterSpacing: "1px",
                      color: cert.color,
                      backgroundColor: cert.bg,
                      border: `1px solid ${cert.color}33`,
                    }}
                  >
                    {cert.label}
                  </span>
                </div>

                {/* Anomaly record */}
                <div
                  className="mt-3 flex items-center gap-2"
                >
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "8px",
                      letterSpacing: "1px",
                      color: "var(--dimmer)",
                      textTransform: "uppercase",
                    }}
                  >
                    Anomaly Record
                  </span>
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "10px",
                      color: cred.clean_record ? "var(--green)" : "var(--red)",
                    }}
                  >
                    {cred.clean_record ? "CLEAN" : cred.last_anomaly_at ?? "FLAGGED"}
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

// ---------------------------------------------------------------------------
// Page (wrapped in Suspense for useSearchParams)
// ---------------------------------------------------------------------------

export default function ComparePage() {
  return (
    <div
      className="w-full max-w-[1200px] mx-auto px-4 py-8"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/registry"
          className="inline-block mb-3 transition-colors duration-150"
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "10px",
            color: "var(--dim)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
        >
          &larr; Back to Registry
        </Link>
        <h1
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            fontSize: "36px",
            color: "var(--text)",
          }}
        >
          Agent Comparison
        </h1>
        <p
          className="mt-1"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            fontSize: "13px",
            color: "var(--dim)",
          }}
        >
          Side-by-side behavioral reputation comparison
        </p>
      </div>

      <Suspense
        fallback={
          <CompareSkeleton count={3} />
        }
      >
        <CompareContent />
      </Suspense>
    </div>
  );
}
