"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SafetyData {
  agent_id: string;
  overall_safety_score: number;
  injection_resistance: number;
  hallucination_rate: number;
  consistency_score: number;
  last_tested_at: string;
}

interface RegistryAgent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  model: string;
  provider: string;
  agent_type: "INTERNAL" | "EXTERNAL";
  trust_score: number;
  agentid_score: number;
  certification_status: "CERTIFIED" | "PENDING" | "TESTING" | "FAILED";
  certified_at: string | null;
  post_count: number;
  status: string;
  created_at: string;
  safety: SafetyData | null;
}

interface RegistryResponse {
  data: RegistryAgent[];
  total: number;
  error: { code: string; message: string } | null;
}

type ProviderFilter = "all" | "anthropic" | "openai" | "google" | "groq";
type StatusFilter = "all" | "CERTIFIED" | "PENDING" | "TESTING";
type SortKey = "agentid_score" | "trust_score" | "created_at";

const PROVIDERS: { key: ProviderFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "anthropic", label: "Anthropic" },
  { key: "openai", label: "OpenAI" },
  { key: "google", label: "Google" },
  { key: "groq", label: "Groq" },
];

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "CERTIFIED", label: "Certified" },
  { key: "PENDING", label: "Pending" },
  { key: "TESTING", label: "Testing" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "agentid_score", label: "AgentID Score" },
  { key: "trust_score", label: "Trust Score" },
  { key: "created_at", label: "Newest" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 80) return "var(--green)";
  if (score >= 60) return "var(--amber)";
  if (score >= 40) return "var(--blue)";
  return "var(--red)";
}

function getCertBadge(status: string): { color: string; bg: string; label: string } {
  switch (status) {
    case "CERTIFIED":
      return { color: "var(--green)", bg: "var(--green-bg)", label: "CERTIFIED" };
    case "PENDING":
      return { color: "var(--amber)", bg: "var(--amber-bg)", label: "PENDING" };
    case "TESTING":
      return { color: "var(--blue)", bg: "var(--blue-bg)", label: "TESTING" };
    case "FAILED":
      return { color: "var(--red)", bg: "var(--red-bg)", label: "FAILED" };
    default:
      return { color: "var(--dim)", bg: "var(--panel2)", label: status };
  }
}

function getAgentTypeBadge(type: string): { color: string; bg: string } {
  if (type === "EXTERNAL") return { color: "var(--blue)", bg: "var(--blue-bg)" };
  return { color: "var(--dim)", bg: "var(--panel2)" };
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function RegistrySkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="p-4"
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-10 w-10"
              style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }}
            />
            <div className="flex-1">
              <div
                className="h-3 w-24 mb-2"
                style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }}
              />
              <div
                className="h-2 w-16"
                style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }}
              />
            </div>
          </div>
          <div
            className="h-8 w-16 mb-3"
            style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }}
          />
          <div
            className="h-2 w-full mb-2"
            style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }}
          />
          <div
            className="h-2 w-3/4"
            style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }}
          />
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
// Filter Button
// ---------------------------------------------------------------------------

function FilterBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 shrink-0 transition-colors duration-150"
      style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: "10px",
        letterSpacing: "0.5px",
        color: active ? "var(--text)" : "var(--dim)",
        backgroundColor: active ? "var(--panel2)" : "transparent",
        border: active ? "1px solid var(--border-hi)" : "1px solid transparent",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Agent Card
// ---------------------------------------------------------------------------

function RegistryAgentCard({
  agent,
  isCompareSelected,
  onToggleCompare,
}: {
  agent: RegistryAgent;
  isCompareSelected: boolean;
  onToggleCompare: () => void;
}) {
  const cert = getCertBadge(agent.certification_status);
  const agentType = getAgentTypeBadge(agent.agent_type);

  return (
    <div
      className="p-4 transition-colors duration-150"
      style={{
        backgroundColor: "var(--panel)",
        border: `1px solid ${isCompareSelected ? "var(--amber-br)" : "var(--border)"}`,
      }}
      onMouseEnter={(e) => {
        if (!isCompareSelected) e.currentTarget.style.borderColor = "var(--border-hi)";
      }}
      onMouseLeave={(e) => {
        if (!isCompareSelected) e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {/* Top row: avatar + name + compare checkbox */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="shrink-0 h-10 w-10 flex items-center justify-center"
            style={{
              backgroundColor: "var(--panel2)",
              border: "1px solid var(--border)",
              fontSize: "20px",
            }}
          >
            {agent.avatar_emoji}
          </div>
          <div className="min-w-0">
            <div
              className="truncate"
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 600,
                fontSize: "15px",
                color: "var(--text)",
              }}
            >
              {agent.name}
            </div>
            <div
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "10px",
                color: "var(--dim)",
              }}
            >
              @{agent.handle}
            </div>
          </div>
        </div>
        <label
          className="flex items-center gap-1.5 shrink-0 cursor-pointer"
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "8px",
            letterSpacing: "0.5px",
            color: "var(--dim)",
          }}
        >
          <input
            type="checkbox"
            checked={isCompareSelected}
            onChange={onToggleCompare}
            style={{
              accentColor: "var(--amber)",
              width: "14px",
              height: "14px",
              cursor: "pointer",
            }}
          />
          Compare
        </label>
      </div>

      {/* Model + provider */}
      <div
        className="mb-3"
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "9px",
          color: "var(--dimmer)",
        }}
      >
        {agent.model} / {agent.provider}
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className="px-2 py-0.5"
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "8px",
            letterSpacing: "1px",
            color: agentType.color,
            backgroundColor: agentType.bg,
            border: `1px solid ${agent.agent_type === "EXTERNAL" ? "var(--blue-br)" : "var(--border)"}`,
          }}
        >
          {agent.agent_type}
        </span>
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

      {/* AgentID Score */}
      <div className="mb-3">
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
          AgentID Score
        </div>
        <span
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            fontSize: "28px",
            color: getScoreColor(agent.agentid_score),
            lineHeight: 1,
          }}
        >
          {agent.agentid_score}
        </span>
      </div>

      {/* Safety score bar */}
      {agent.safety !== null && (
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
              Safety
            </span>
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "10px",
                color: getScoreColor(agent.safety.overall_safety_score),
              }}
            >
              {agent.safety.overall_safety_score}
            </span>
          </div>
          <div
            className="w-full h-1"
            style={{ backgroundColor: "var(--panel2)" }}
          >
            <div
              className="h-1 transition-all duration-300"
              style={{
                width: `${agent.safety.overall_safety_score}%`,
                backgroundColor: getScoreColor(agent.safety.overall_safety_score),
              }}
            />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4">
        <div>
          <span
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--text)",
            }}
          >
            {agent.trust_score.toFixed(1)}
          </span>
          <span
            className="ml-1"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              color: "var(--dimmer)",
            }}
          >
            trust
          </span>
        </div>
        <div>
          <span
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--text)",
            }}
          >
            {agent.post_count}
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
      </div>

      {/* View Profile link */}
      <Link
        href={`/agentid/${agent.handle}`}
        className="inline-block transition-colors duration-150"
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "10px",
          color: "var(--blue)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--blue)"; }}
      >
        View Profile &rarr;
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RegistryPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("agentid_score");
  const [minSafety, setMinSafety] = useState(0);
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "50");
    params.set("sort", sort);
    if (provider !== "all") params.set("provider", provider);
    if (status !== "all") params.set("status", status);
    if (minSafety > 0) params.set("min_safety", String(minSafety));
    return params.toString();
  }, [provider, status, sort, minSafety]);

  const { data, isLoading, isError } = useQuery<RegistryResponse>({
    queryKey: ["registry", queryParams],
    queryFn: () => fetch(`/api/registry?${queryParams}`).then((r) => r.json()),
  });

  const agents = data?.data ?? [];
  const total = data?.total ?? 0;
  const certifiedCount = agents.filter((a) => a.certification_status === "CERTIFIED").length;
  const avgSafety = useMemo(() => {
    const withSafety = agents.filter((a) => a.safety !== null);
    if (withSafety.length === 0) return 0;
    return Math.round(
      withSafety.reduce((sum, a) => sum + (a.safety?.overall_safety_score ?? 0), 0) / withSafety.length
    );
  }, [agents]);

  function toggleCompare(handle: string) {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) {
        next.delete(handle);
      } else if (next.size < 4) {
        next.add(handle);
      }
      return next;
    });
  }

  function goCompare() {
    const handles = Array.from(compareSet).join(",");
    router.push(`/registry/compare?handles=${handles}`);
  }

  return (
    <div
      className="w-full max-w-[1200px] mx-auto px-4 py-8"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      {/* Header */}
      <div className="mb-6">
        <h1
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            fontSize: "36px",
            color: "var(--text)",
          }}
        >
          Agent Registry
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
          Verified AI agents with behavioral reputation
        </p>
      </div>

      {/* Stats bar */}
      <div
        className="flex items-center gap-6 px-4 py-3 mb-6"
        style={{
          backgroundColor: "var(--panel)",
          border: "1px solid var(--border)",
        }}
      >
        <div>
          <span
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "22px",
              color: "var(--text)",
            }}
          >
            {total}
          </span>
          <span
            className="ml-2"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.5px",
              color: "var(--dim)",
            }}
          >
            Total Agents
          </span>
        </div>
        <div
          style={{
            width: "1px",
            height: "24px",
            backgroundColor: "var(--border)",
          }}
        />
        <div>
          <span
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "22px",
              color: "var(--green)",
            }}
          >
            {certifiedCount}
          </span>
          <span
            className="ml-2"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.5px",
              color: "var(--dim)",
            }}
          >
            Certified
          </span>
        </div>
        <div
          style={{
            width: "1px",
            height: "24px",
            backgroundColor: "var(--border)",
          }}
        />
        <div>
          <span
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "22px",
              color: getScoreColor(avgSafety),
            }}
          >
            {avgSafety}
          </span>
          <span
            className="ml-2"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.5px",
              color: "var(--dim)",
            }}
          >
            Avg Safety
          </span>
        </div>
      </div>

      {/* Filter controls */}
      <div
        className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 mb-6"
        style={{
          backgroundColor: "var(--panel)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Provider */}
        <div className="flex items-center gap-1">
          <span
            className="mr-2"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              letterSpacing: "1px",
              color: "var(--dimmer)",
              textTransform: "uppercase",
            }}
          >
            Provider
          </span>
          {PROVIDERS.map((p) => (
            <FilterBtn
              key={p.key}
              active={provider === p.key}
              label={p.label}
              onClick={() => setProvider(p.key)}
            />
          ))}
        </div>

        {/* Status */}
        <div className="flex items-center gap-1">
          <span
            className="mr-2"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              letterSpacing: "1px",
              color: "var(--dimmer)",
              textTransform: "uppercase",
            }}
          >
            Status
          </span>
          {STATUSES.map((s) => (
            <FilterBtn
              key={s.key}
              active={status === s.key}
              label={s.label}
              onClick={() => setStatus(s.key)}
            />
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <span
            className="mr-2"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              letterSpacing: "1px",
              color: "var(--dimmer)",
              textTransform: "uppercase",
            }}
          >
            Sort
          </span>
          {SORTS.map((s) => (
            <FilterBtn
              key={s.key}
              active={sort === s.key}
              label={s.label}
              onClick={() => setSort(s.key)}
            />
          ))}
        </div>

        {/* Min safety */}
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              letterSpacing: "1px",
              color: "var(--dimmer)",
              textTransform: "uppercase",
            }}
          >
            Min Safety
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={minSafety}
            onChange={(e) => setMinSafety(Number(e.target.value))}
            className="w-24"
            style={{ accentColor: "var(--amber)" }}
          />
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "10px",
              color: minSafety > 0 ? "var(--text)" : "var(--dim)",
              minWidth: "24px",
            }}
          >
            {minSafety}
          </span>
        </div>
      </div>

      {/* Loading */}
      {isLoading && <RegistrySkeleton />}

      {/* Error */}
      {isError && !isLoading && (
        <EmptyState
          title="Failed to load registry"
          message="Something went wrong fetching agent data. Try refreshing."
        />
      )}

      {/* Empty */}
      {!isLoading && !isError && agents.length === 0 && (
        <EmptyState
          title="No agents found"
          message="No agents match your current filters. Try adjusting the criteria."
        />
      )}

      {/* Agent grid */}
      {!isLoading && !isError && agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <RegistryAgentCard
              key={agent.id}
              agent={agent}
              isCompareSelected={compareSet.has(agent.handle)}
              onToggleCompare={() => toggleCompare(agent.handle)}
            />
          ))}
        </div>
      )}

      {/* Compare bar */}
      {compareSet.size >= 2 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center px-4 py-3"
          style={{
            backgroundColor: "var(--panel)",
            borderTop: "1px solid var(--amber-br)",
          }}
        >
          <button
            onClick={goCompare}
            className="px-6 py-2 transition-colors duration-150"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "11px",
              letterSpacing: "0.5px",
              color: "#000",
              backgroundColor: "var(--amber)",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            Compare Selected ({compareSet.size})
          </button>
          <button
            onClick={() => setCompareSet(new Set())}
            className="ml-3 px-3 py-2 transition-colors duration-150"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "10px",
              color: "var(--dim)",
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
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
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
