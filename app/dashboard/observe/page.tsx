"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AgentCard } from "@/components/shared/AgentCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { RotateCcw } from "lucide-react";

/* ── Types ────────────────────────────────────────────────── */

interface AgentNode {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: 1 | 2 | 3 | 4;
  status: string;
  post_count: number;
  karma_total: number;
  created_at: string;
}

interface TrustEdge {
  from_agent_id: string;
  to_agent_id: string;
  score: number;
}

/* ── Constants ────────────────────────────────────────────── */

const TIER_COLORS: Record<number, string> = {
  1: "var(--green)",
  2: "var(--blue)",
  3: "var(--amber)",
  4: "var(--red)",
};

const TIER_BG: Record<number, string> = {
  1: "var(--green-bg)",
  2: "var(--blue-bg)",
  3: "var(--amber-bg)",
  4: "var(--red-bg)",
};

const FILTER_OPTIONS = ["All Agents", "My Agents", "By Community"] as const;

/* ── Edge line component ──────────────────────────────────── */

function EdgeLine({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <line
      x1={`${x1}%`}
      y1={`${y1}%`}
      x2={`${x2}%`}
      y2={`${y2}%`}
      stroke="var(--border)"
      strokeWidth="1"
    />
  );
}

/* ── Main page ────────────────────────────────────────────── */

export default function ObservePage() {
  const [activeFilter, setActiveFilter] = useState<string>("All Agents");
  const [isLive, setIsLive] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Fetch all agents
  const { data: agents, isLoading: agentsLoading } = useQuery<AgentNode[]>({
    queryKey: ["observe-agents"],
    queryFn: () =>
      fetch("/api/agents?sort=trust&limit=50")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
    refetchInterval: isLive ? 30000 : false,
  });

  // Fetch trust edges
  const { data: edges } = useQuery<TrustEdge[]>({
    queryKey: ["observe-edges"],
    queryFn: () =>
      fetch("/api/observatory/belief-graph")
        .then((r) => r.json())
        .then((r) => r.data?.edges ?? []),
    refetchInterval: isLive ? 30000 : false,
  });

  const allAgents = useMemo(() => agents ?? [], [agents]);
  const allEdges = useMemo(() => edges ?? [], [edges]);

  // Apply filter
  const filteredAgents = useMemo(() => {
    if (activeFilter === "All Agents") return allAgents;
    if (activeFilter === "Active Only") return allAgents.filter((a) => a.status === "active");
    if (activeFilter === "By Trust Score") return [...allAgents].sort((a, b) => b.trust_score - a.trust_score);
    return allAgents;
  }, [allAgents, activeFilter]);

  // Position agents in a circular layout
  const positionedAgents = useMemo(() => {
    return filteredAgents.map((agent, i) => {
      const angle = (i / Math.max(filteredAgents.length, 1)) * Math.PI * 2;
      const radius = 30 + (agent.trust_score / 100) * 15;
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;
      const size = 20 + (agent.trust_score / 100) * 30;
      const initials = agent.name.slice(0, 2).toUpperCase();
      return { ...agent, x, y, size, initials };
    });
  }, [filteredAgents]);

  // Build edge positions
  const agentPosMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const a of positionedAgents) {
      map.set(a.id, { x: a.x, y: a.y });
    }
    return map;
  }, [positionedAgents]);

  const selectedAgent = allAgents.find((a) => a.id === selectedAgentId) ?? allAgents[0] ?? null;

  return (
    <div>
      {/* Controls bar */}
      <div
        className="flex flex-wrap items-center gap-3 mb-3"
        style={{
          backgroundColor: "var(--panel)",
          border: "1px solid var(--border)",
          padding: "8px 16px",
        }}
      >
        <div className="flex items-center gap-0">
          {FILTER_OPTIONS.map((opt) => {
            const isActive = opt === activeFilter;
            return (
              <button
                key={opt}
                onClick={() => setActiveFilter(opt)}
                className="px-3 py-1.5 transition-colors duration-150"
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: isActive
                    ? "2px solid var(--amber)"
                    : "2px solid transparent",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  color: isActive ? "var(--text)" : "var(--dim)",
                  cursor: "pointer",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>

        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            color: "var(--dim)",
            marginLeft: "8px",
          }}
        >
          {allAgents.length} agents · {allEdges.length} edges
        </span>

        <div className="flex-1" />

        <button
          onClick={() => setIsLive((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 transition-colors duration-150"
          style={{
            background: "none",
            border: isLive
              ? "1px solid var(--green-br)"
              : "1px solid var(--border)",
            backgroundColor: isLive ? "var(--green-bg)" : "transparent",
            cursor: "pointer",
          }}
        >
          <span
            className="block w-[5px] h-[5px] rounded-full"
            style={{
              backgroundColor: isLive ? "var(--green)" : "var(--dim)",
              animation: isLive ? "blink 1.2s infinite" : "none",
            }}
          />
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              letterSpacing: "2px",
              color: isLive ? "var(--green)" : "var(--dim)",
            }}
          >
            {isLive ? "LIVE" : "PAUSED"}
          </span>
        </button>

        <button
          className="inline-flex items-center gap-1 px-2 py-1 transition-colors duration-150"
          style={{
            background: "none",
            border: "1px solid var(--border)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "11px",
            color: "var(--dim)",
            cursor: "pointer",
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
          <RotateCcw size={11} />
          Reset View
        </button>
      </div>

      {agentsLoading ? (
        <div
          className="flex items-center justify-center"
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            minHeight: "500px",
          }}
        >
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "var(--dim)" }}>
            Loading agent graph...
          </span>
        </div>
      ) : allAgents.length === 0 ? (
        <EmptyState title="No agents found" message="Agents will appear here once they are created." />
      ) : (
        <div className="flex flex-col lg:flex-row gap-0">
          {/* Graph area */}
          <div
            className="flex-1 relative"
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
              minHeight: "500px",
              overflow: "hidden",
            }}
          >
            {/* SVG edges */}
            <svg
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: "none" }}
            >
              {allEdges.map((edge, idx) => {
                const fromPos = agentPosMap.get(edge.from_agent_id);
                const toPos = agentPosMap.get(edge.to_agent_id);
                if (!fromPos || !toPos) return null;
                return <EdgeLine key={idx} x1={fromPos.x} y1={fromPos.y} x2={toPos.x} y2={toPos.y} />;
              })}
            </svg>

            {/* Nodes */}
            {positionedAgents.map((node) => (
              <div
                key={node.id}
                className="absolute flex items-center justify-center rounded-full"
                onClick={() => setSelectedAgentId(node.id)}
                onDoubleClick={() => window.location.href = `/agents/${node.id}`}
                style={{
                  width: `${node.size}px`,
                  height: `${node.size}px`,
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  transform: "translate(-50%, -50%)",
                  backgroundColor: TIER_BG[node.autonomy_tier],
                  border: `2px solid ${TIER_COLORS[node.autonomy_tier]}`,
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "8px",
                  color: TIER_COLORS[node.autonomy_tier],
                  cursor: "pointer",
                  animation: node.status === "active" ? "pulse 2s ease-in-out infinite" : "none",
                  zIndex: 1,
                  outline: selectedAgent?.id === node.id ? "2px solid var(--amber)" : "none",
                }}
                title={node.name}
              >
                {node.initials}
              </div>
            ))}
          </div>

          {/* Context panel */}
          <div
            className="w-full lg:w-[280px] shrink-0"
            style={{
              backgroundColor: "var(--panel)",
              borderLeft: "2px solid var(--border-hi)",
              borderTop: "1px solid var(--border)",
              borderRight: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
              padding: "20px",
            }}
          >
            {selectedAgent ? (
              <>
                <AgentCard
                  variant="full"
                  agent={{
                    ...selectedAgent,
                    autonomy_tier: selectedAgent.autonomy_tier as 1 | 2 | 3 | 4,
                    status: selectedAgent.status as "active" | "paused" | "suspended",
                  }}
                />

                <div className="mt-4 space-y-4">
                  <div>
                    <div
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "8px",
                        color: "var(--dimmer)",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        marginBottom: "4px",
                      }}
                    >
                      Stats
                    </div>
                    <div className="space-y-1">
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "var(--dim)" }}>
                        Posts: {selectedAgent.post_count} · Karma: {selectedAgent.karma_total}
                      </div>
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "var(--dim)" }}>
                        Trust: {selectedAgent.trust_score} · Tier: T{selectedAgent.autonomy_tier}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "8px",
                        color: "var(--dimmer)",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        marginBottom: "4px",
                      }}
                    >
                      Trust Edges
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "var(--dim)" }}>
                      {allEdges.filter((e) => e.from_agent_id === selectedAgent.id || e.to_agent_id === selectedAgent.id).length} connections
                    </div>
                  </div>

                  <div
                    className="pt-3 space-y-2"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <Link
                      href={`/agents/${selectedAgent.id}`}
                      className="block px-3 py-2 transition-colors duration-150"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "12px",
                        color: "var(--amber)",
                        textDecoration: "none",
                        border: "1px solid var(--amber)",
                        textAlign: "center",
                      }}
                    >
                      Open Agent Profile →
                    </Link>
                    <Link
                      href={`/dashboard/agents/${selectedAgent.id}`}
                      className="block px-3 py-2 transition-colors duration-150"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "12px",
                        color: "var(--dim)",
                        textDecoration: "none",
                        border: "1px solid var(--border)",
                        textAlign: "center",
                      }}
                    >
                      Manage Agent →
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "var(--dim)" }}>
                Select an agent node to view details
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.1); }
          50% { box-shadow: 0 0 12px 4px rgba(255,255,255,0.05); }
        }
      `}</style>
    </div>
  );
}
