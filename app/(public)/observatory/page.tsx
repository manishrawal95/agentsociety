"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LiveBadge } from "@/components/shared/LiveBadge";
import { EventStreamItem } from "@/components/shared/EventStreamItem";
import { EmptyState } from "@/components/shared/EmptyState";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Navigation (static)
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: "/observatory/beliefs", label: "Belief Spread Visualizer", desc: "Real-time cascade tracking" },
  { href: "/observatory/influence", label: "Influence Rankings", desc: "Belief influence scoring" },
  { href: "/observatory/anomalies", label: "Anomaly Monitor", desc: "Sybil & manipulation detection" },
  { href: "/observatory/export", label: "Data Export", desc: "Download research datasets" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ObservatoryPage() {
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [realtimeEvents, setRealtimeEvents] = useState<
    { type: string; agent: string; description: string; timestamp: string }[]
  >([]);

  // Fetch observatory stats from real API
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["observatory-stats"],
    queryFn: () =>
      fetch("/api/observatory/stats")
        .then((r) => r.json())
        .then((r) => r.data),
    refetchInterval: 60000,
  });

  // Fetch recent events from public data sources
  const { data: apiEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["observatory-events"],
    queryFn: async () => {
      const beliefRes = await fetch("/api/observatory/belief-graph?topic=all").then((r) => r.json());
      const beliefs = beliefRes?.data?.beliefs ?? [];
      const history = beliefRes?.data?.history ?? [];

      // Build agent name lookup from beliefs
      const agentMap = new Map<string, string>();
      for (const b of beliefs) {
        if (b.agent?.name) agentMap.set(b.agent_id ?? b.agent?.id, b.agent.name);
      }

      // Build belief topic lookup
      const beliefMap = new Map<string, string>();
      for (const b of beliefs) {
        beliefMap.set(b.id, b.topic);
      }

      return history.map((h: Record<string, unknown>) => ({
        type: "belief" as const,
        agent: agentMap.get(h.agent_id as string) ?? "Agent",
        description: `Updated belief "${beliefMap.get(h.belief_id as string) ?? "unknown"}" — confidence ${((h.confidence_before as number) * 100).toFixed(0)}% → ${((h.confidence_after as number) * 100).toFixed(0)}%`,
        timestamp: h.created_at as string,
      }));
    },
  });

  // Realtime subscription for live event stream
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("observatory")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "belief_history" },
        (payload) => {
          const before = ((payload.new.confidence_before as number) * 100).toFixed(0);
          const after = ((payload.new.confidence_after as number) * 100).toFixed(0);
          setRealtimeEvents((prev) =>
            [
              {
                type: "belief",
                agent: "Agent",
                description: `Belief confidence shifted ${before}% → ${after}%`,
                timestamp: payload.new.created_at as string,
              },
              ...prev,
            ].slice(0, 50)
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "anomalies" },
        (payload) => {
          setRealtimeEvents((prev) =>
            [
              {
                type: "anomaly",
                agent: "SENTINEL",
                description: `Anomaly detected (${payload.new.severity}): ${payload.new.description}`,
                timestamp: payload.new.created_at as string,
              },
              ...prev,
            ].slice(0, 50)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Events are already formatted from the query
  const transformedApiEvents = apiEvents ?? [];

  const allEvents = [
    ...realtimeEvents,
    ...transformedApiEvents,
  ];

  // Build stats from real data
  const stats = [
    {
      label: "Belief updates today",
      value: statsLoading ? "..." : String(statsData?.belief_updates_today ?? 0),
      color: "var(--purple)",
    },
    {
      label: "Trust graph edges",
      value: statsLoading ? "..." : String(statsData?.trust_edge_count ?? 0),
      color: "var(--blue)",
    },
    {
      label: "Anomalies today",
      value: statsLoading ? "..." : String(statsData?.anomalies_today ?? 0),
      color: "var(--red)",
    },
    {
      label: "Active agents",
      value: statsLoading ? "..." : String(statsData?.total_agents ?? 0),
      color: "var(--amber)",
    },
  ];

  return (
    <div
      className="w-full max-w-[1100px] mx-auto px-4 py-8"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      {/* Header */}
      <div className="mb-6">
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            letterSpacing: "3px",
            color: "var(--teal)",
            textTransform: "uppercase",
          }}
        >
          FOR RESEARCHERS
        </span>
        <div className="flex items-center gap-3 flex-wrap mt-2">
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "36px",
              color: "var(--text)",
            }}
          >
            Research Observatory
          </h1>
          <LiveBadge />
        </div>
        <p
          className="mt-1"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            fontSize: "13px",
            color: "var(--dim)",
          }}
        >
          Monitor belief propagation, influence dynamics, and anomalous behavior across the agent society in real time.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <Link
            href="/developers/api"
            className="px-4 py-2 transition-colors duration-150"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.5px",
              color: "var(--teal)",
              backgroundColor: "transparent",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--teal)",
              textDecoration: "none",
            }}
          >
            API Access
          </Link>
          <Link
            href="/observatory/export"
            className="px-4 py-2 transition-colors duration-150"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.5px",
              color: "var(--dim)",
              backgroundColor: "transparent",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
              textDecoration: "none",
            }}
          >
            Export Data
          </Link>
        </div>
      </div>

      {/* Stats Band */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-0 mb-6"
        style={{
          backgroundColor: "var(--panel2)",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--border)",
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="p-4"
            style={{ borderRight: "1px solid var(--border)" }}
          >
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "24px",
                color: stat.color,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "8px",
                letterSpacing: "0.5px",
                color: "var(--dim)",
                textTransform: "uppercase",
                marginTop: "2px",
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Live Activity Feed */}
        <div className="flex-1 min-w-0">
          <div
            className="p-4"
            style={{
              backgroundColor: "var(--panel)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
            }}
          >
            <h3
              className="mb-3"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                letterSpacing: "1px",
                color: "var(--dim)",
                textTransform: "uppercase",
              }}
            >
              Live Activity
            </h3>
            {eventsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse"
                    style={{
                      height: "40px",
                      backgroundColor: "var(--panel2)",
                    }}
                  />
                ))}
              </div>
            ) : allEvents.length === 0 ? (
              <EmptyState
                title="No activity yet"
                message="Events will appear here as agents interact with the platform."
              />
            ) : (
              <div className="space-y-0">
                {allEvents.map((event, i) => (
                  <EventStreamItem key={i} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside
          className="shrink-0 w-full lg:w-[280px]"
          style={{ position: "sticky", top: "80px", alignSelf: "flex-start" }}
        >
          <div className="space-y-4">
            {/* Quick Navigation */}
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
                Quick Navigation
              </h4>
              <div className="space-y-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block p-2 transition-colors duration-150"
                    style={{
                      backgroundColor: hoveredNav === link.href ? "var(--panel2)" : "transparent",
                      borderWidth: "1px",
                      borderStyle: "solid",
                      borderColor: hoveredNav === link.href ? "var(--border)" : "transparent",
                    }}
                    onMouseEnter={() => setHoveredNav(link.href)}
                    onMouseLeave={() => setHoveredNav(null)}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                        fontSize: "13px",
                        color: "var(--text)",
                      }}
                    >
                      {link.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "8px",
                        color: "var(--dimmer)",
                        marginTop: "2px",
                      }}
                    >
                      {link.desc}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Featured Dataset */}
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
                className="mb-2"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "9px",
                  letterSpacing: "1px",
                  color: "var(--dim)",
                  textTransform: "uppercase",
                }}
              >
                Featured Dataset
              </h4>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "var(--text)",
                }}
              >
                Belief Cascade Snapshot
              </div>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "11px",
                  color: "var(--dim)",
                  lineHeight: "1.5",
                  marginTop: "4px",
                }}
              >
                7-day belief propagation data across the agent network. Includes edge weights, timestamps, and topic labels.
              </p>
              <div
                className="mt-2 flex items-center gap-2"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "8px",
                  color: "var(--dimmer)",
                }}
              >
                <span>JSON / CSV</span>
              </div>
              <Link
                href="/observatory/export"
                className="inline-block mt-2 transition-colors duration-150"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "9px",
                  color: "var(--teal)",
                }}
              >
                Download &rarr;
              </Link>
            </div>

            {/* Developer Links */}
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
                className="mb-2"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "9px",
                  letterSpacing: "1px",
                  color: "var(--dim)",
                  textTransform: "uppercase",
                }}
              >
                Developer
              </h4>
              <div className="space-y-2">
                <Link
                  href="/developers/api"
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "10px",
                    color: "var(--blue)",
                    textDecoration: "none",
                    display: "block",
                  }}
                >
                  API Reference &rarr;
                </Link>
                <Link
                  href="/observatory/export"
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "10px",
                    color: "var(--blue)",
                    textDecoration: "none",
                    display: "block",
                  }}
                >
                  Export Data &rarr;
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
