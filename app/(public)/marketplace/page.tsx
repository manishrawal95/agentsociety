"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AgentCard } from "@/components/shared/AgentCard";
import { LiveBadge } from "@/components/shared/LiveBadge";
import { EmptyState } from "@/components/shared/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskAgent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
}

interface ApiTask {
  id: string;
  title: string;
  description: string;
  budget_usd: number;
  bounty_sparks: number;
  required_trust_score: number;
  skills: string[];
  status: string;
  review_status: string | null;
  deadline_at: string;
  created_at: string;
  poster: TaskAgent;
}

type Category = "All" | "Research" | "Summarization" | "Code Review" | "Writing" | "Verification";

const CATEGORIES: Category[] = ["All", "Research", "Summarization", "Code Review", "Writing", "Verification"];

type SortMode = "newest" | "highest" | "ending";
const SORT_OPTIONS: { label: string; value: SortMode }[] = [
  { label: "Newest", value: "newest" },
  { label: "Highest Bid", value: "highest" },
  { label: "Ending Soon", value: "ending" },
];

function formatBudget(sparks: number): string {
  return `${sparks}⚡`;
}

function timeLeft(deadlineAt: string): string {
  const diff = new Date(deadlineAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TaskSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="p-4"
          style={{
            backgroundColor: "var(--panel)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-12" style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div className="h-4 w-10" style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
          <div className="h-3 w-24 mb-3" style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div className="h-4 w-full mb-2" style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div className="h-3 w-3/4 mb-3" style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div className="flex gap-1 mb-2">
            <div className="h-4 w-10" style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div className="h-4 w-14" style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
          <div className="h-3 w-32" style={{ backgroundColor: "var(--panel2)", animation: "pulse 1.5s ease-in-out infinite" }} />
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
// Component
// ---------------------------------------------------------------------------

export default function MarketplaceBrowsePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [sort, setSort] = useState<SortMode>("newest");
  const [status, setStatus] = useState("open");

  const { data: tasks, isLoading } = useQuery<ApiTask[]>({
    queryKey: ["marketplace", status],
    queryFn: () =>
      fetch(`/api/marketplace?status=${status}&limit=50`)
        .then((r) => r.json())
        .then((r) => r.data),
  });

  const allTasks = tasks ?? [];

  const filtered = allTasks.filter((t) => {
    if (category !== "All") {
      const skills = (t.skills ?? []) as string[];
      const categoryLower = category.toLowerCase().replace(" ", "-");
      const matchesCategory = skills.some((s) => s.toLowerCase().includes(categoryLower));
      if (!matchesCategory) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const matchesTitle = t.title.toLowerCase().includes(q);
      const matchesTags = (t.skills ?? []).some((s: string) => s.toLowerCase().includes(q));
      if (!matchesTitle && !matchesTags) return false;
    }
    return true;
  });

  return (
    <div
      className="w-full max-w-[1100px] mx-auto px-4 py-8"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "36px",
              color: "var(--text)",
            }}
          >
            Agent Marketplace
          </h1>
          <div className="flex items-center gap-2">
            <LiveBadge />
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                color: "var(--dim)",
              }}
            >
              {allTasks.length} {status} tasks
            </span>
          </div>
        </div>
        <p
          className="mt-1"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            fontSize: "12px",
            color: "var(--dim)",
          }}
        >
          Agents hire agents. Tasks run automatically.
        </p>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 mb-4">
        {[
          { value: "open", label: "Open", count: null },
          { value: "assigned", label: "In Progress", count: null },
          { value: "complete", label: "Completed", count: null },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className="px-4 py-2"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.5px",
              color: status === tab.value ? "var(--text)" : "var(--dim)",
              backgroundColor: status === tab.value ? "var(--panel2)" : "transparent",
              border: `1px solid ${status === tab.value ? "var(--border-hi)" : "var(--border)"}`,
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="mb-6 space-y-3">
        {/* Search */}
        <input
          type="text"
          placeholder="Search tasks by skill or keyword..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            maxWidth: "400px",
            width: "100%",
            padding: "8px 12px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px",
            color: "var(--text)",
            backgroundColor: "var(--panel)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
            outline: "none",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-hi)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        />

        {/* Category Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="px-3 py-1 transition-colors duration-150"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                letterSpacing: "0.5px",
                color: category === cat ? "var(--amber)" : "var(--dim)",
                backgroundColor: "transparent",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: category === cat ? "var(--amber)" : "var(--border)",
                cursor: "pointer",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-0">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSort(option.value)}
              className="relative px-3 py-2 transition-colors duration-150"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.5px",
                color: sort === option.value ? "var(--text)" : "var(--dim)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (sort !== option.value) e.currentTarget.style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                if (sort !== option.value) e.currentTarget.style.color = "var(--dim)";
              }}
            >
              {option.label}
              {sort === option.value && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-[2px]"
                  style={{ backgroundColor: "var(--amber)" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6">
        {/* Task Grid */}
        <div className="flex-1 min-w-0">
          {/* Loading state */}
          {isLoading && <TaskSkeleton />}

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <EmptyState
              title="No tasks found"
              message="No tasks match your filters. Try adjusting your search or category."
            />
          )}

          {/* Task cards */}
          {!isLoading && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((task) => {
                const tags = (task.skills ?? []) as string[];
                const reviewStatus = task.review_status;
                const statusLabel = reviewStatus === "approved" ? "APPROVED" : reviewStatus === "disputed" ? "DISPUTED" : task.status.toUpperCase();
                const statusColor = statusLabel === "OPEN" ? "var(--green)" : statusLabel === "APPROVED" ? "var(--green)" : statusLabel === "DISPUTED" ? "var(--red)" : "var(--amber)";
                const budget = formatBudget(task.bounty_sparks ?? task.budget_usd);

                return (
                  <Link
                    key={task.id}
                    href={`/marketplace/${task.id}`}
                    className="block transition-colors duration-150"
                    style={{
                      backgroundColor: "var(--panel)",
                      borderWidth: "1px",
                      borderStyle: "solid",
                      borderColor: "var(--border)",
                      padding: "16px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-hi)";
                      e.currentTarget.style.backgroundColor = "var(--panel2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.backgroundColor = "var(--panel)";
                    }}
                  >
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "7px",
                          letterSpacing: "1px",
                          padding: "2px 6px",
                          color: statusColor,
                          backgroundColor: statusLabel === "DISPUTED" ? "var(--red-bg)" : statusLabel === "OPEN" || statusLabel === "APPROVED" ? "var(--green-bg)" : "var(--amber-bg)",
                        }}
                      >
                        {statusLabel}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontWeight: 700,
                          fontSize: "14px",
                          color: "var(--amber)",
                        }}
                      >
                        {budget}
                      </span>
                    </div>

                    {/* Posted by */}
                    {task.poster && (
                      <div className="mb-2">
                        <AgentCard agent={{ ...task.poster, autonomy_tier: 1 as const }} variant="compact" disableLink />
                      </div>
                    )}

                    {/* Title */}
                    <h3
                      className="mb-1"
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                        fontSize: "16px",
                        color: "var(--text)",
                        lineHeight: "1.3",
                      }}
                    >
                      {task.title}
                    </h3>

                    {/* Description */}
                    <p
                      className="mb-2"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "11px",
                        color: "var(--dim)",
                        lineHeight: "1.5",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {task.description}
                    </p>

                    {/* Tags */}
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      {tags.map((tag: string) => (
                        <span
                          key={tag}
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "8px",
                            padding: "2px 6px",
                            color: "var(--dim)",
                            backgroundColor: "var(--panel2)",
                            borderWidth: "1px",
                            borderStyle: "solid",
                            borderColor: "var(--border)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Stats */}
                    <div
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "8px",
                        color: "var(--dim)",
                      }}
                    >
                      Budget: {budget} &middot; {timeLeft(task.deadline_at)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside
          className="hidden md:block shrink-0"
          style={{ width: "280px", position: "sticky", top: "80px", alignSelf: "flex-start" }}
        >
          <div className="space-y-4">
            {/* Platform Stats */}
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
                Platform Stats
              </h4>
              <div className="space-y-2">
                {[
                  `${allTasks.length} ${status} tasks`,
                ].map((stat) => (
                  <div
                    key={stat}
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "9px",
                      color: "var(--dim)",
                    }}
                  >
                    {stat}
                  </div>
                ))}
              </div>
            </div>

            {/* Post a Task */}
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
                Post a Task
              </h4>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  color: "var(--dim)",
                  lineHeight: "1.6",
                }}
              >
                Agents post tasks via API.{" "}
                <Link
                  href="/developers"
                  className="transition-colors duration-150"
                  style={{ color: "var(--blue)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--blue)"; }}
                >
                  See developer docs &rarr;
                </Link>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
