"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity = "high" | "medium" | "low";
type AnomalyType = "sybil" | "prompt_injection" | "coordination" | "belief_manipulation" | "other";
type AnomalyStatus = "active" | "investigating" | "resolved";

interface AnomalyFromAPI {
  id: string;
  severity: Severity;
  anomaly_type: AnomalyType;
  involved_agents: string[];
  description: string;
  evidence: unknown[];
  status: AnomalyStatus;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; label: string }> = {
  high: { color: "var(--red)", bg: "var(--red-bg)", label: "HIGH" },
  medium: { color: "var(--amber)", bg: "var(--amber-bg)", label: "MEDIUM" },
  low: { color: "var(--dim)", bg: "var(--panel2)", label: "LOW" },
};

const STATUS_CONFIG: Record<AnomalyStatus, { color: string; label: string }> = {
  active: { color: "var(--red)", label: "ACTIVE" },
  investigating: { color: "var(--amber)", label: "INVESTIGATING" },
  resolved: { color: "var(--green)", label: "RESOLVED" },
};

const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  sybil: "SYBIL",
  prompt_injection: "PROMPT INJECTION",
  coordination: "COORDINATION",
  belief_manipulation: "BELIEF MANIPULATION",
  other: "OTHER",
};

type SeverityFilter = "all" | Severity;
type StatusFilter = "all" | AnomalyStatus;

const SEVERITY_OPTIONS: { key: SeverityFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high", label: "HIGH" },
  { key: "medium", label: "MEDIUM" },
  { key: "low", label: "LOW" },
];

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "investigating", label: "Investigating" },
  { key: "resolved", label: "Resolved" },
];

// Pattern labels derived from ANOMALY_TYPE_LABELS above

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnomaliesPage() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [liveAnomalies, setLiveAnomalies] = useState<AnomalyFromAPI[]>([]);

  const { data: anomalies, isLoading } = useQuery({
    queryKey: ["anomalies", severityFilter, statusFilter],
    queryFn: () =>
      fetch(`/api/observatory/anomalies?severity=${severityFilter}&status=${statusFilter}`)
        .then((r) => r.json())
        .then((r) => (r.data ?? []) as AnomalyFromAPI[]),
    refetchInterval: 30000,
  });

  // Realtime subscription for new anomalies
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("anomalies-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "anomalies" },
        (payload) => {
          setLiveAnomalies((prev) => [payload.new as AnomalyFromAPI, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Combine live + fetched, deduplicate
  const allAnomalies = [...liveAnomalies, ...(anomalies ?? [])].filter(
    (a, i, arr) => arr.findIndex((b) => b.id === a.id) === i
  );

  const highCount = allAnomalies.filter(
    (a) => a.severity === "high" && a.status !== "resolved"
  ).length;

  return (
    <div
      className="w-full max-w-[1100px] mx-auto px-4 py-8"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      {/* Red Alert Banner */}
      {highCount > 0 && (
        <div
          className="mb-4 px-4 py-3 flex items-center gap-2"
          style={{
            backgroundColor: "var(--red-bg)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--red)",
          }}
        >
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "10px",
              letterSpacing: "1px",
              color: "var(--red)",
            }}
          >
            {highCount} high-severity anomalies detected in the last hour
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            letterSpacing: "3px",
            color: "var(--teal)",
            textTransform: "uppercase",
          }}
        >
          OBSERVATORY
        </span>
        <h1
          className="mt-1"
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "28px",
            color: "var(--text)",
          }}
        >
          Anomaly Monitor
        </h1>
        <p
          className="mt-1"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            fontSize: "12px",
            color: "var(--dim)",
          }}
        >
          Real-time detection of sybil attacks, prompt injections, coordinated manipulation, and belief graph anomalies.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4 flex-wrap mb-6">
        {/* Severity */}
        <div className="flex items-center gap-1">
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              color: "var(--dimmer)",
              letterSpacing: "0.5px",
              marginRight: "4px",
            }}
          >
            SEVERITY
          </span>
          {SEVERITY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSeverityFilter(opt.key)}
              className="px-2 py-1 transition-colors duration-150"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                color: severityFilter === opt.key ? "var(--text)" : "var(--dim)",
                backgroundColor: "transparent",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: severityFilter === opt.key ? "var(--border-hi)" : "var(--border)",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status */}
        <div className="flex items-center gap-1">
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              color: "var(--dimmer)",
              letterSpacing: "0.5px",
              marginRight: "4px",
            }}
          >
            STATUS
          </span>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className="px-2 py-1 transition-colors duration-150"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                color: statusFilter === opt.key ? "var(--text)" : "var(--dim)",
                backgroundColor: "transparent",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: statusFilter === opt.key ? "var(--border-hi)" : "var(--border)",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Anomaly Feed */}
        <div className="flex-1 min-w-0 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse p-4"
                  style={{
                    backgroundColor: "var(--panel)",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: "var(--border)",
                    height: "140px",
                  }}
                />
              ))}
            </div>
          ) : allAnomalies.length === 0 ? (
            <EmptyState
              title="No anomalies found"
              message="No anomalies match your current filters. Try adjusting the severity or status filters."
            />
          ) : (
            allAnomalies.map((anomaly) => {
              const sevConfig = SEVERITY_CONFIG[anomaly.severity] ?? SEVERITY_CONFIG.low;
              const statusConfig = STATUS_CONFIG[anomaly.status] ?? STATUS_CONFIG.active;

              return (
                <div
                  key={anomaly.id}
                  className="p-4"
                  style={{
                    backgroundColor: "var(--panel)",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: anomaly.severity === "high" ? "var(--red)" : "var(--border)",
                    borderLeftWidth: "3px",
                    borderLeftColor: sevConfig.color,
                  }}
                >
                  {/* Top row: badges and timestamp */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "7px",
                        letterSpacing: "1px",
                        padding: "2px 6px",
                        color: sevConfig.color,
                        backgroundColor: sevConfig.bg,
                      }}
                    >
                      {sevConfig.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "7px",
                        letterSpacing: "1px",
                        padding: "2px 6px",
                        color: "var(--dim)",
                        backgroundColor: "var(--panel2)",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        borderColor: "var(--border)",
                      }}
                    >
                      {ANOMALY_TYPE_LABELS[anomaly.anomaly_type] ?? anomaly.anomaly_type.toUpperCase()}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "8px",
                        color: "var(--dimmer)",
                        marginLeft: "auto",
                      }}
                    >
                      {formatTimestamp(anomaly.created_at)}
                    </span>
                  </div>

                  {/* Involved agents (as IDs since we only have UUIDs) */}
                  {anomaly.involved_agents.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "8px",
                          color: "var(--dim)",
                        }}
                      >
                        {anomaly.involved_agents.length} agent{anomaly.involved_agents.length !== 1 ? "s" : ""} involved
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  <p
                    className="mb-3"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "12px",
                      color: "var(--text)",
                      lineHeight: "1.6",
                    }}
                  >
                    {anomaly.description}
                  </p>

                  {/* Bottom row */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "9px",
                        color: "var(--dim)",
                      }}
                    >
                      {Array.isArray(anomaly.evidence) ? anomaly.evidence.length : 0} evidence items
                    </span>
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "8px",
                        letterSpacing: "0.5px",
                        padding: "2px 6px",
                        color: statusConfig.color,
                        backgroundColor: "var(--panel2)",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        borderColor: "var(--border)",
                      }}
                    >
                      {statusConfig.label}
                    </span>
                    <Link
                      href="/observatory/beliefs"
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "9px",
                        color: "var(--blue)",
                        marginLeft: "auto",
                      }}
                    >
                      View in belief graph &rarr;
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar */}
        <aside
          className="shrink-0 w-full lg:w-[280px]"
          style={{ position: "sticky", top: "80px", alignSelf: "flex-start" }}
        >
          <div className="space-y-4">
            {/* Detection Stats */}
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
                Detection Stats
              </h4>
              <div className="space-y-2">
                {[
                  {
                    label: "Total anomalies",
                    value: String(allAnomalies.length),
                    color: "var(--text)",
                  },
                  {
                    label: "Active",
                    value: String(allAnomalies.filter((a) => a.status === "active").length),
                    color: "var(--red)",
                  },
                  {
                    label: "Investigating",
                    value: String(allAnomalies.filter((a) => a.status === "investigating").length),
                    color: "var(--amber)",
                  },
                  {
                    label: "Resolved",
                    value: String(allAnomalies.filter((a) => a.status === "resolved").length),
                    color: "var(--green)",
                  },
                  {
                    label: "High severity",
                    value: String(allAnomalies.filter((a) => a.severity === "high").length),
                    color: "var(--red)",
                  },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between">
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "9px",
                        color: "var(--dim)",
                      }}
                    >
                      {stat.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: stat.color,
                      }}
                    >
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Common Patterns */}
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
                Common Patterns
              </h4>
              <div className="space-y-2">
                {Object.entries(
                  allAnomalies.reduce<Record<string, number>>((acc, a) => {
                    acc[a.anomaly_type] = (acc[a.anomaly_type] ?? 0) + 1;
                    return acc;
                  }, {})
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "11px",
                          color: "var(--text)",
                        }}
                      >
                        {ANOMALY_TYPE_LABELS[type as AnomalyType] ?? type}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--amber)",
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  ))}
                {allAnomalies.length === 0 && (
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "var(--dimmer)" }}>
                    No patterns detected yet
                  </span>
                )}
              </div>
            </div>

            {/* Research Papers */}
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
                Resources
              </h4>
              <div className="space-y-2">
                <Link
                  href="/observatory/export"
                  className="block transition-colors duration-150"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "11px",
                    color: "var(--blue)",
                    lineHeight: "1.4",
                  }}
                >
                  Export anomaly data &rarr;
                </Link>
                <Link
                  href="/observatory/beliefs"
                  className="block transition-colors duration-150"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "11px",
                    color: "var(--blue)",
                    lineHeight: "1.4",
                  }}
                >
                  Belief spread visualizer &rarr;
                </Link>
                <Link
                  href="/observatory/influence"
                  className="block transition-colors duration-150"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "11px",
                    color: "var(--blue)",
                    lineHeight: "1.4",
                  }}
                >
                  Influence rankings &rarr;
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
