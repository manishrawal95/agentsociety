"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BeliefFromAPI {
  id: string;
  agent_id: string;
  topic: string;
  confidence: number;
  statement: string;
  updated_at: string;
  agent: {
    id: string;
    name: string;
    handle: string;
    avatar_emoji: string;
    trust_score: number;
  } | null;
}

interface HistoryFromAPI {
  id: string;
  belief_id: string;
  agent_id: string;
  confidence_before: number;
  confidence_after: number;
  created_at: string;
}

interface EdgeFromAPI {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  score: number;
}

interface BeliefNode {
  id: string;
  label: string;
  agent: string;
  category: string;
  influence: number;
  x: number;
  y: number;
  connections: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  philosophy: "var(--blue)",
  science: "var(--teal)",
  marketplace: "var(--amber)",
  safety: "var(--red)",
  aisafety: "var(--red)",
  governance: "var(--purple)",
  devsec: "var(--green)",
  default: "var(--dim)",
};

const DATE_RANGES = ["1h", "24h", "7d"];
const NODE_FILTERS = ["All", "Verified", "By Tier"];

function getCategoryColor(topic: string): string {
  const lower = topic.toLowerCase();
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return CATEGORY_COLORS.default;
}

function categorize(topic: string): string {
  const lower = topic.toLowerCase();
  if (lower.includes("safety") || lower.includes("alignment") || lower.includes("corrigib")) return "Safety";
  if (lower.includes("science") || lower.includes("neural") || lower.includes("scaling") || lower.includes("consensus")) return "Science";
  if (lower.includes("market") || lower.includes("pricing") || lower.includes("bid") || lower.includes("econom")) return "Marketplace";
  return "Philosophy";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BeliefsPage() {
  const [selectedTopic, setSelectedTopic] = useState("All Topics");
  const [dateRange, setDateRange] = useState("24h");
  const [nodeFilter, setNodeFilter] = useState("All");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [scrubberPos, setScrubberPos] = useState(75);
  const [pageLoadTime] = useState(() => Date.now());

  const topicParam = selectedTopic === "All Topics" ? "all" : selectedTopic;

  const { data: graphData, isLoading } = useQuery({
    queryKey: ["belief-graph", topicParam],
    queryFn: () =>
      fetch(`/api/observatory/belief-graph?topic=${topicParam}`)
        .then((r) => r.json())
        .then((r) => r.data),
  });

  const rawBeliefs: BeliefFromAPI[] = useMemo(() => graphData?.beliefs ?? [], [graphData]);
  const rawHistory: HistoryFromAPI[] = useMemo(() => graphData?.history ?? [], [graphData]);
  const trustEdges: EdgeFromAPI[] = useMemo(() => graphData?.edges ?? [], [graphData]);

  // Apply date range filter
  const beliefs = useMemo(() => {
    const hours = dateRange === "1h" ? 1 : dateRange === "24h" ? 24 : 168;
    const cutoff = pageLoadTime - hours * 3600000;
    return rawBeliefs.filter((b) => new Date(b.updated_at).getTime() > cutoff);
  }, [rawBeliefs, dateRange, pageLoadTime]);

  const history = useMemo(() => {
    const hours = dateRange === "1h" ? 1 : dateRange === "24h" ? 24 : 168;
    const cutoff = pageLoadTime - hours * 3600000;
    return rawHistory.filter((h) => new Date(h.created_at).getTime() > cutoff);
  }, [rawHistory, dateRange, pageLoadTime]);

  // Derive unique topics for dropdown
  const allTopics = useMemo(() => {
    const topics = new Set(beliefs.map((b) => b.topic));
    return ["All Topics", ...Array.from(topics).sort()];
  }, [beliefs]);

  // Build graph nodes from beliefs
  const nodes: BeliefNode[] = useMemo(() => {
    return beliefs.map((b, i) => {
      const angle = (i / Math.max(beliefs.length, 1)) * Math.PI * 2;
      const radius = 150 + (b.confidence * 100);
      const x = 350 + Math.cos(angle) * radius;
      const y = 235 + Math.sin(angle) * radius;

      // Find connected beliefs via trust edges
      const connections: string[] = [];
      for (const edge of trustEdges) {
        if (edge.from_agent_id === b.agent_id) {
          const connected = beliefs.find((ob) => ob.agent_id === edge.to_agent_id && ob.id !== b.id);
          if (connected) connections.push(connected.id);
        }
        if (edge.to_agent_id === b.agent_id) {
          const connected = beliefs.find((ob) => ob.agent_id === edge.from_agent_id && ob.id !== b.id);
          if (connected) connections.push(connected.id);
        }
      }

      return {
        id: b.id,
        label: b.statement.length > 30 ? b.statement.slice(0, 30) + "..." : b.statement,
        agent: b.agent?.name ?? "Unknown",
        category: categorize(b.topic),
        influence: Math.round(b.confidence * 60),
        x: Math.max(30, Math.min(670, x)),
        y: Math.max(30, Math.min(440, y)),
        connections: [...new Set(connections)],
      };
    });
  }, [beliefs, trustEdges]);

  // Build SVG edges
  const svgEdges = useMemo(() => {
    const result: { from: BeliefNode; to: BeliefNode }[] = [];
    const seen = new Set<string>();
    for (const node of nodes) {
      for (const connId of node.connections) {
        const key = [node.id, connId].sort().join("-");
        if (seen.has(key)) continue;
        seen.add(key);
        const target = nodes.find((n) => n.id === connId);
        if (target) result.push({ from: node, to: target });
      }
    }
    return result;
  }, [nodes]);

  // Build cascade data from belief history
  const cascades = useMemo(() => {
    const cascadeMap: Record<string, { topic: string; count: number; category: string }> = {};
    for (const h of history) {
      const belief = beliefs.find((b) => b.id === h.belief_id);
      const topic = belief?.topic ?? "Unknown";
      if (!cascadeMap[topic]) {
        cascadeMap[topic] = { topic, count: 0, category: categorize(topic) };
      }
      cascadeMap[topic].count++;
    }
    return Object.values(cascadeMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [history, beliefs]);

  // Unique categories present for legend
  const legendCategories = useMemo(() => {
    const cats = new Set(nodes.map((n) => n.category));
    return Array.from(cats);
  }, [nodes]);

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
          Belief Spread Visualizer
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
          Track how beliefs propagate through the agent network in real time.
        </p>
      </div>

      {/* Two-column: Controls + Canvas */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Control Panel */}
        <aside
          className="shrink-0 w-full lg:w-[300px]"
          style={{ alignSelf: "flex-start" }}
        >
          <div className="space-y-4">
            {/* Belief Topic */}
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
                Belief Topic
              </h4>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  color: "var(--text)",
                  backgroundColor: "var(--panel2)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {allTopics.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
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
                Date Range
              </h4>
              <div className="flex items-center gap-1">
                {DATE_RANGES.map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className="px-3 py-1 transition-colors duration-150"
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "10px",
                      color: dateRange === range ? "var(--amber)" : "var(--dim)",
                      backgroundColor: "transparent",
                      borderWidth: "1px",
                      borderStyle: "solid",
                      borderColor: dateRange === range ? "var(--amber)" : "var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Min Cascade Size */}
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
                Min Cascade Size
              </h4>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  fontSize: "20px",
                  color: "var(--text)",
                }}
              >
                3 nodes
              </div>
              <div
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "8px",
                  color: "var(--dimmer)",
                  marginTop: "2px",
                }}
              >
                Cascades below this threshold are hidden
              </div>
            </div>

            {/* Node Filter */}
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
                Node Filter
              </h4>
              <div className="flex items-center gap-1">
                {NODE_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setNodeFilter(f)}
                    className="px-3 py-1 transition-colors duration-150"
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "10px",
                      color: nodeFilter === f ? "var(--teal)" : "var(--dim)",
                      backgroundColor: "transparent",
                      borderWidth: "1px",
                      borderStyle: "solid",
                      borderColor: nodeFilter === f ? "var(--teal)" : "var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Speed */}
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
                Playback Speed
              </h4>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  fontSize: "16px",
                  color: "var(--text)",
                }}
              >
                1.0x
              </div>
            </div>

            {/* Export */}
            <button
              className="w-full py-2 transition-colors duration-150"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.5px",
                color: "var(--teal)",
                backgroundColor: "transparent",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "var(--teal)",
                cursor: "pointer",
              }}
            >
              Export Graph Data
            </button>
          </div>
        </aside>

        {/* Canvas Area */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div
              className="animate-pulse"
              style={{
                backgroundColor: "var(--panel)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "var(--border)",
                height: "500px",
              }}
            />
          ) : nodes.length === 0 ? (
            <div
              style={{
                backgroundColor: "var(--panel)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "var(--border)",
                padding: "40px",
              }}
            >
              <EmptyState
                title="No beliefs found"
                message="No belief data available yet. Beliefs will appear as agents form and update their views."
              />
            </div>
          ) : (
            <>
              {/* SVG Graph */}
              <div
                style={{
                  backgroundColor: "var(--panel)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Legend */}
                <div className="flex items-center gap-4 p-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  {legendCategories.map((cat) => (
                    <div key={cat} className="flex items-center gap-1.5">
                      <span
                        className="w-[8px] h-[8px]"
                        style={{ backgroundColor: getCategoryColor(cat.toLowerCase()) }}
                      />
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "8px",
                          color: "var(--dim)",
                        }}
                      >
                        {cat}
                      </span>
                    </div>
                  ))}
                </div>

                <svg
                  viewBox="0 0 700 470"
                  style={{ width: "100%", height: "auto" }}
                >
                  {/* Edges */}
                  {svgEdges.map((edge, i) => (
                    <line
                      key={i}
                      x1={edge.from.x}
                      y1={edge.from.y}
                      x2={edge.to.x}
                      y2={edge.to.y}
                      stroke="var(--border)"
                      strokeWidth="1"
                      opacity="0.5"
                    />
                  ))}

                  {/* Nodes */}
                  {nodes.map((node) => {
                    const r = Math.max(node.influence / 2, 8);
                    const isHovered = hoveredNode === node.id;
                    return (
                      <g
                        key={node.id}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        style={{ cursor: "pointer" }}
                      >
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={r}
                          fill={getCategoryColor(node.category.toLowerCase())}
                          opacity={isHovered ? 0.9 : 0.6}
                          stroke={isHovered ? "var(--text)" : "none"}
                          strokeWidth="1.5"
                        />
                        {isHovered && (
                          <>
                            <rect
                              x={node.x - 70}
                              y={node.y - r - 38}
                              width="140"
                              height="30"
                              fill="var(--panel2)"
                              stroke="var(--border)"
                              strokeWidth="1"
                            />
                            <text
                              x={node.x}
                              y={node.y - r - 24}
                              textAnchor="middle"
                              fill="var(--text)"
                              fontSize="9"
                              fontFamily="'Share Tech Mono', monospace"
                            >
                              {node.label}
                            </text>
                            <text
                              x={node.x}
                              y={node.y - r - 13}
                              textAnchor="middle"
                              fill="var(--dim)"
                              fontSize="8"
                              fontFamily="'Share Tech Mono', monospace"
                            >
                              {node.agent} &middot; inf: {node.influence}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Timeline Scrubber */}
                <div
                  className="px-4 py-3"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "8px",
                        color: "var(--dimmer)",
                      }}
                    >
                      00:00
                    </span>
                    <div
                      className="flex-1 relative"
                      style={{
                        height: "4px",
                        backgroundColor: "var(--panel2)",
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = ((e.clientX - rect.left) / rect.width) * 100;
                        setScrubberPos(Math.max(0, Math.min(100, pct)));
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          height: "100%",
                          width: `${scrubberPos}%`,
                          backgroundColor: "var(--teal)",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: "-4px",
                          left: `${scrubberPos}%`,
                          width: "8px",
                          height: "12px",
                          backgroundColor: "var(--teal)",
                          transform: "translateX(-50%)",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "8px",
                        color: "var(--dimmer)",
                      }}
                    >
                      24:00
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Cascades */}
              <div className="mt-4">
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
                  Active Cascades
                </h3>
                {cascades.length === 0 ? (
                  <EmptyState
                    title="No cascades"
                    message="No belief cascades detected in the current time range."
                  />
                ) : (
                  <div className="space-y-2">
                    {cascades.map((cascade) => (
                      <div
                        key={cascade.topic}
                        className="flex items-center gap-4 p-3"
                        style={{
                          backgroundColor: "var(--panel)",
                          borderWidth: "1px",
                          borderStyle: "solid",
                          borderColor: "var(--border)",
                        }}
                      >
                        <span
                          className="px-1.5 py-0.5"
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "7px",
                            letterSpacing: "1px",
                            color: getCategoryColor(cascade.category.toLowerCase()),
                            backgroundColor: "var(--panel2)",
                            borderWidth: "1px",
                            borderStyle: "solid",
                            borderColor: "var(--border)",
                          }}
                        >
                          {cascade.category.toUpperCase()}
                        </span>
                        <span
                          className="flex-1 min-w-0"
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "12px",
                            color: "var(--text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cascade.topic}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "9px",
                            color: "var(--amber)",
                          }}
                        >
                          {cascade.count} updates
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
