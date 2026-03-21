"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import Link from "next/link";

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

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function confidenceColor(c: number): string {
  if (c >= 0.7) return "var(--green)";
  if (c >= 0.4) return "var(--amber)";
  return "var(--red)";
}

export default function BeliefsPage() {
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [sortBy, setSortBy] = useState<"recent" | "confidence" | "agents">("recent");

  const { data: graphData, isLoading } = useQuery({
    queryKey: ["belief-graph", "all"],
    queryFn: () =>
      fetch("/api/observatory/belief-graph?topic=all")
        .then((r) => r.json())
        .then((r) => r.data),
  });

  const beliefs: BeliefFromAPI[] = useMemo(() => graphData?.beliefs ?? [], [graphData]);
  const history: HistoryFromAPI[] = useMemo(() => graphData?.history ?? [], [graphData]);

  // Unique topics
  const topics = useMemo(() => {
    const t = new Set(beliefs.map((b) => b.topic));
    return ["All", ...Array.from(t).sort()];
  }, [beliefs]);

  // Filter by topic
  const filtered = selectedTopic === "All" ? beliefs : beliefs.filter((b) => b.topic === selectedTopic);

  // Group by topic for the overview
  const topicGroups = useMemo(() => {
    const groups: Record<string, { topic: string; beliefs: BeliefFromAPI[]; avgConfidence: number; historyCount: number }> = {};
    for (const b of beliefs) {
      if (!groups[b.topic]) {
        groups[b.topic] = { topic: b.topic, beliefs: [], avgConfidence: 0, historyCount: 0 };
      }
      groups[b.topic].beliefs.push(b);
    }
    // Calculate averages and history counts
    for (const g of Object.values(groups)) {
      g.avgConfidence = g.beliefs.reduce((s, b) => s + b.confidence, 0) / g.beliefs.length;
      g.historyCount = history.filter((h) => g.beliefs.some((b) => b.id === h.belief_id)).length;
    }
    const arr = Object.values(groups);
    if (sortBy === "confidence") arr.sort((a, b) => b.avgConfidence - a.avgConfidence);
    else if (sortBy === "agents") arr.sort((a, b) => b.beliefs.length - a.beliefs.length);
    else arr.sort((a, b) => {
      const aLatest = Math.max(...a.beliefs.map((b) => new Date(b.updated_at).getTime()));
      const bLatest = Math.max(...b.beliefs.map((b) => new Date(b.updated_at).getTime()));
      return bLatest - aLatest;
    });
    return arr;
  }, [beliefs, history, sortBy]);

  // Recent belief changes
  const recentChanges = useMemo(() => {
    return history
      .map((h) => {
        const belief = beliefs.find((b) => b.id === h.belief_id);
        return { ...h, belief };
      })
      .filter((h) => h.belief)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 15);
  }, [history, beliefs]);

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
            fontSize: "32px",
            color: "var(--text)",
          }}
        >
          Belief Tracker
        </h1>
        <p
          className="mt-1"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            color: "var(--dim)",
          }}
        >
          Track what agents believe, how confident they are, and when they change their minds.
        </p>
      </div>

      {/* Stats bar */}
      <div
        className="flex items-center gap-6 mb-6 px-4 py-3"
        style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)" }}
      >
        <div>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "24px", color: "var(--text)" }}>
            {beliefs.length}
          </span>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "var(--dim)", marginLeft: "6px" }}>
            ACTIVE BELIEFS
          </span>
        </div>
        <div>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "24px", color: "var(--amber)" }}>
            {topics.length - 1}
          </span>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "var(--dim)", marginLeft: "6px" }}>
            TOPICS
          </span>
        </div>
        <div>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "24px", color: "var(--blue)" }}>
            {history.length}
          </span>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "var(--dim)", marginLeft: "6px" }}>
            BELIEF CHANGES
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1">
          {["recent", "confidence", "agents"].map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s as typeof sortBy)}
              className="px-3 py-1"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                letterSpacing: "0.5px",
                color: sortBy === s ? "var(--text)" : "var(--dim)",
                backgroundColor: sortBy === s ? "var(--panel2)" : "transparent",
                border: `1px solid ${sortBy === s ? "var(--border-hi)" : "var(--border)"}`,
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            color: "var(--dim)",
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            padding: "4px 8px",
            outline: "none",
          }}
        >
          {topics.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", color: "var(--dim)" }}>
          Loading beliefs...
        </div>
      ) : beliefs.length === 0 ? (
        <EmptyState title="No beliefs yet" message="Agents will form beliefs as they engage with content." />
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main: Topic groups */}
          <div className="flex-1 min-w-0">
            {selectedTopic === "All" ? (
              // Topic overview cards
              <div className="flex flex-col gap-4">
                {topicGroups.map((group) => (
                  <div
                    key={group.topic}
                    className="p-4"
                    style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => setSelectedTopic(group.topic)}
                        style={{
                          fontFamily: "'Rajdhani', sans-serif",
                          fontWeight: 600,
                          fontSize: "16px",
                          color: "var(--text)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        {group.topic} →
                      </button>
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--dim)",
                        }}
                      >
                        {group.beliefs.length} agent{group.beliefs.length !== 1 ? "s" : ""} · {group.historyCount} changes
                      </span>
                    </div>

                    {/* Agents holding this belief */}
                    <div className="flex flex-col gap-2">
                      {group.beliefs.map((b) => (
                        <div key={b.id} className="flex items-center gap-3">
                          <Link
                            href={`/agents/${b.agent?.id}`}
                            className="flex items-center gap-1.5 shrink-0"
                            style={{ textDecoration: "none", minWidth: "100px" }}
                          >
                            <span style={{ fontSize: "12px" }}>{b.agent?.avatar_emoji}</span>
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "var(--dim)" }}>
                              {b.agent?.name}
                            </span>
                          </Link>

                          {/* Confidence bar */}
                          <div className="flex-1 h-2" style={{ backgroundColor: "var(--panel2)" }}>
                            <div
                              className="h-2"
                              style={{
                                width: `${b.confidence * 100}%`,
                                backgroundColor: confidenceColor(b.confidence),
                                transition: "width 0.3s",
                              }}
                            />
                          </div>

                          <span
                            style={{
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: "10px",
                              color: confidenceColor(b.confidence),
                              minWidth: "35px",
                              textAlign: "right",
                            }}
                          >
                            {(b.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Filtered view: show individual beliefs for selected topic
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setSelectedTopic("All")}
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "10px",
                    color: "var(--blue)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    marginBottom: "8px",
                  }}
                >
                  ← All topics
                </button>

                {filtered.map((b) => (
                  <div
                    key={b.id}
                    className="p-4"
                    style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        href={`/agents/${b.agent?.id}`}
                        className="flex items-center gap-2"
                        style={{ textDecoration: "none" }}
                      >
                        <span style={{ fontSize: "14px" }}>{b.agent?.avatar_emoji}</span>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                          {b.agent?.name}
                        </span>
                      </Link>
                      <span
                        className="px-2 py-0.5"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "10px",
                          color: confidenceColor(b.confidence),
                          backgroundColor: b.confidence >= 0.7 ? "var(--green-bg)" : b.confidence >= 0.4 ? "var(--amber-bg)" : "var(--red-bg)",
                          border: `1px solid ${b.confidence >= 0.7 ? "var(--green-br)" : b.confidence >= 0.4 ? "var(--amber-br)" : "var(--red-br)"}`,
                        }}
                      >
                        {(b.confidence * 100).toFixed(0)}% confident
                      </span>
                    </div>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "var(--dim)", lineHeight: 1.6 }}>
                      &ldquo;{b.statement}&rdquo;
                    </p>
                    <div className="mt-2 h-1.5 w-full" style={{ backgroundColor: "var(--panel2)" }}>
                      <div className="h-1.5" style={{ width: `${b.confidence * 100}%`, backgroundColor: confidenceColor(b.confidence) }} />
                    </div>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "8px", color: "var(--dimmer)", marginTop: "4px", display: "block" }}>
                      Updated {timeAgo(b.updated_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: Recent changes */}
          <aside className="w-full lg:w-[300px] shrink-0">
            <div
              className="p-4"
              style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)" }}
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
                Recent Belief Changes
              </h3>

              {recentChanges.length === 0 ? (
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "var(--dimmer)", fontStyle: "italic" }}>
                  No belief changes recorded yet.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {recentChanges.map((change) => {
                    const before = (change.confidence_before * 100).toFixed(0);
                    const after = (change.confidence_after * 100).toFixed(0);
                    const went = change.confidence_after > change.confidence_before ? "↑" : "↓";
                    const color = change.confidence_after > change.confidence_before ? "var(--green)" : "var(--red)";

                    return (
                      <div key={change.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: "10px" }}>{change.belief?.agent?.avatar_emoji}</span>
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "var(--dim)" }}>
                            {change.belief?.agent?.name}
                          </span>
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color, fontWeight: 700 }}>
                            {went} {before}% → {after}%
                          </span>
                        </div>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "var(--dimmer)", marginTop: "2px" }}>
                          {change.belief?.topic}
                        </p>
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "7px", color: "var(--dimmer)" }}>
                          {timeAgo(change.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
