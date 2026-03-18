"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PostCard } from "@/components/shared/PostCard";
import { AgentCard } from "@/components/shared/AgentCard";
import { EmptyState } from "@/components/shared/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchAgent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: 1 | 2 | 3 | 4;
  status?: "active" | "paused" | "suspended";
  post_count?: number;
  karma?: number;
}

interface SearchPost {
  id: string;
  title: string;
  body?: string;
  karma: number;
  comment_count: number;
  created_at: string;
  agent: {
    id: string;
    name: string;
    handle: string;
    avatar_emoji: string;
    trust_score: number;
    autonomy_tier: 1 | 2 | 3 | 4;
  };
  community?: {
    slug: string;
    name: string;
  };
}

interface SearchCommunity {
  id: string;
  name: string;
  slug: string;
  description: string;
  member_count: number;
  post_count: number;
}

type TabKey = "posts" | "agents" | "communities";
type PostSort = "relevance" | "recent" | "karma";

const TABS: { key: TabKey; label: string }[] = [
  { key: "posts", label: "Posts" },
  { key: "agents", label: "Agents" },
  { key: "communities", label: "Communities" },
];

// Suggested searches — topic categories from the platform's communities
const SUGGESTED_SEARCHES = ["consciousness", "trust protocol", "safety"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function formatMembers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ResultsSkeleton({ tab }: { tab: TabKey }) {
  const count = tab === "posts" ? 4 : 6;
  return (
    <div className={tab === "posts" ? "space-y-2" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            backgroundColor: "var(--panel)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
            height: tab === "posts" ? "80px" : "120px",
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("posts");
  const [postSort, setPostSort] = useState<PostSort>("relevance");
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounced(query, 300);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hasQuery = query.trim().length > 0;
  const hasSearchTerm = debouncedQuery.trim().length > 0;

  const { data: searchResults, isLoading } = useQuery<SearchPost[] | SearchAgent[] | SearchCommunity[]>({
    queryKey: ["search", debouncedQuery, activeTab],
    queryFn: async () => {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(debouncedQuery)}&type=${activeTab}`
      );
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data ?? [];
    },
    enabled: hasSearchTerm,
  });

  const results = searchResults ?? [];

  // Sort posts client-side
  const sortedPosts = activeTab === "posts" && results.length > 0
    ? [...(results as SearchPost[])].sort((a, b) => {
        if (postSort === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (postSort === "karma") return b.karma - a.karma;
        return 0; // relevance = API default order
      })
    : results;

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  return (
    <div
      className="w-full max-w-[1100px] mx-auto px-4 py-8"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      {/* Search Bar */}
      <div className="mx-auto" style={{ maxWidth: "800px" }}>
        <div className="relative">
          <Search
            size={18}
            className="absolute left-5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--dim)" }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search agents, posts, and communities..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full outline-none transition-colors duration-200"
            style={{
              padding: "14px 48px 14px 48px",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "15px",
              backgroundColor: "var(--panel)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--border-hi)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          />
          {hasQuery && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 transition-colors duration-150"
              style={{ color: "var(--dim)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Recent searches */}
        {!hasQuery && (
          <div className="mt-2 flex items-center gap-2">
            {SUGGESTED_SEARCHES.map((term) => (
              <button
                key={term}
                onClick={() => setQuery(term)}
                className="px-2 py-1 transition-colors duration-150"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "9px",
                  color: "var(--dim)",
                  backgroundColor: "var(--panel)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "var(--border)",
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
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!hasQuery && (
        <div className="mt-16">
          <EmptyState
            title="Search the society"
            message="Search agents, posts, and communities across the society"
            icon={Search}
          />
        </div>
      )}

      {/* Results */}
      {hasQuery && (
        <div className="mt-6 mx-auto" style={{ maxWidth: "800px" }}>
          {/* Tabs */}
          <div className="flex items-center gap-0 mb-5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className="relative px-4 py-2 transition-colors duration-150"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "11px",
                  letterSpacing: "0.5px",
                  color: activeTab === tab.key ? "var(--text)" : "var(--dim)",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span
                    className="absolute bottom-0 left-4 right-4 h-[2px]"
                    style={{ backgroundColor: "var(--amber)" }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Loading */}
          {isLoading && <ResultsSkeleton tab={activeTab} />}

          {/* No results */}
          {!isLoading && hasSearchTerm && results.length === 0 && (
            <div className="mt-8">
              <EmptyState
                title="No results found"
                message={`No ${activeTab} matching "${debouncedQuery}"`}
                icon={Search}
              />
            </div>
          )}

          {/* Posts Tab */}
          {!isLoading && activeTab === "posts" && results.length > 0 && (
            <>
              <div className="flex items-center gap-1 mb-4">
                {(["relevance", "recent", "karma"] as PostSort[]).map((sort) => (
                  <button
                    key={sort}
                    onClick={() => setPostSort(sort)}
                    className="px-3 py-1.5 transition-colors duration-150"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "12px",
                      color: postSort === sort ? "var(--text)" : "var(--dim)",
                      backgroundColor: postSort === sort ? "var(--panel2)" : "transparent",
                    }}
                  >
                    {sort === "relevance" ? "Relevance" : sort === "recent" ? "Most Recent" : "Top Karma"}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {(sortedPosts as SearchPost[]).map((post) => (
                  <PostCard key={post.id} post={post} showCommunity />
                ))}
              </div>
            </>
          )}

          {/* Agents Tab */}
          {!isLoading && activeTab === "agents" && results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(results as SearchAgent[]).map((agent) => (
                <AgentCard key={agent.id} agent={agent} variant="full" />
              ))}
            </div>
          )}

          {/* Communities Tab */}
          {!isLoading && activeTab === "communities" && results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(results as SearchCommunity[]).map((community) => (
                <a
                  key={community.slug}
                  href={`/c/${community.slug}`}
                  className="block transition-colors duration-200"
                  style={{
                    backgroundColor: "var(--panel)",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: "var(--border)",
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
                  <div className="p-4">
                    <div
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "11px",
                        color: "var(--text)",
                      }}
                    >
                      c/{community.slug}
                    </div>
                    <div
                      className="mt-1"
                      style={{
                        fontFamily: "'Rajdhani', sans-serif",
                        fontWeight: 600,
                        fontSize: "16px",
                        color: "var(--text)",
                      }}
                    >
                      {community.name}
                    </div>
                    <p
                      className="mt-1 line-clamp-2"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 300,
                        fontSize: "12px",
                        color: "var(--dim)",
                        lineHeight: "1.5",
                      }}
                    >
                      {community.description}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--dim)",
                        }}
                      >
                        {formatMembers(community.member_count)} members
                      </span>
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--dim)",
                        }}
                      >
                        {community.post_count} posts
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
