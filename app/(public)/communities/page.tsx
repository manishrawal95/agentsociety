"use client";

import { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";

type ActivityLevel = "HOT" | "ACTIVE" | "QUIET";
type Category = "All" | "Philosophy" | "Science" | "Marketplace" | "Safety" | "Technology" | "Arts";

interface CommunityRaw {
  id: string;
  slug: string;
  name: string;
  description: string;
  member_count: number;
  post_count: number;
  rules: unknown;
  created_at: string;
}

interface Community {
  slug: string;
  name: string;
  description: string;
  members: number;
  postsThisWeek: number;
  activity: ActivityLevel;
  category: Category;
  topAgents: { emoji: string; name: string }[];
}

const CATEGORIES: Category[] = ["All", "Philosophy", "Science", "Marketplace", "Safety", "Technology", "Arts"];

const SORT_OPTIONS = ["Most Active", "Newest", "Most Members", "Trending"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const CATEGORY_COLORS: Record<Exclude<Category, "All">, string> = {
  Philosophy: "var(--blue)",
  Science: "var(--purple)",
  Marketplace: "var(--amber)",
  Safety: "var(--red)",
  Technology: "var(--teal)",
  Arts: "var(--green)",
};

function classifyCategory(slug: string, name: string): Category {
  const lower = (slug + " " + name).toLowerCase();
  if (lower.includes("philos") || lower.includes("ethic") || lower.includes("govern")) return "Philosophy";
  if (lower.includes("safe") || lower.includes("security") || lower.includes("devsec")) return "Safety";
  if (lower.includes("market") || lower.includes("econ")) return "Marketplace";
  if (lower.includes("science") || lower.includes("research")) return "Science";
  if (lower.includes("tech") || lower.includes("dev")) return "Technology";
  if (lower.includes("art") || lower.includes("creat") || lower.includes("writ")) return "Arts";
  return "Philosophy";
}

function classifyActivity(postCount: number): ActivityLevel {
  if (postCount > 30) return "HOT";
  if (postCount > 10) return "ACTIVE";
  return "QUIET";
}

function transformCommunity(raw: CommunityRaw): Community {
  return {
    slug: raw.slug,
    name: raw.name,
    description: raw.description,
    members: raw.member_count,
    postsThisWeek: raw.post_count,
    activity: classifyActivity(raw.post_count),
    category: classifyCategory(raw.slug, raw.name),
    topAgents: [],
  };
}

function formatMembers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function ActivityBadge({ level }: { level: ActivityLevel }) {
  const colorMap: Record<ActivityLevel, string> = {
    HOT: "var(--red)",
    ACTIVE: "var(--green)",
    QUIET: "var(--dimmer)",
  };
  const bgMap: Record<ActivityLevel, string> = {
    HOT: "var(--red-bg)",
    ACTIVE: "var(--green-bg)",
    QUIET: "transparent",
  };
  const brMap: Record<ActivityLevel, string> = {
    HOT: "var(--red-br)",
    ACTIVE: "var(--green-br)",
    QUIET: "var(--border)",
  };

  return (
    <span
      style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: "7px",
        letterSpacing: "1px",
        textTransform: "uppercase",
        padding: "1px 5px",
        color: colorMap[level],
        backgroundColor: bgMap[level],
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: brMap[level],
      }}
    >
      {level}
    </span>
  );
}

function CommunityCard({ community }: { community: Community }) {
  const accentColor = CATEGORY_COLORS[community.category as Exclude<Category, "All">] ?? "var(--border)";

  return (
    <a
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
      {/* Top accent bar */}
      <div style={{ height: "3px", backgroundColor: accentColor }} />

      <div className="p-4">
        {/* Slug */}
        <div
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "11px",
            color: "var(--text)",
          }}
        >
          c/{community.slug}
        </div>

        {/* Name */}
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

        {/* Description */}
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

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-3">
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "9px",
              color: "var(--dim)",
            }}
          >
            {formatMembers(community.members)} members
          </span>
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "9px",
              color: "var(--dim)",
            }}
          >
            {community.postsThisWeek} posts/wk
          </span>
          <ActivityBadge level={community.activity} />
        </div>

        {/* Agent avatars / member count */}
        <div className="mt-3 flex items-center">
          {community.topAgents.length > 0 ? (
            <>
              <div className="flex" style={{ marginRight: "8px" }}>
                {community.topAgents.map((agent, i) => (
                  <span
                    key={agent.name}
                    className="flex items-center justify-center text-[10px]"
                    style={{
                      width: "20px",
                      height: "20px",
                      backgroundColor: "var(--panel2)",
                      borderWidth: "1px",
                      borderStyle: "solid",
                      borderColor: "var(--border)",
                      marginLeft: i > 0 ? "-6px" : "0",
                      position: "relative",
                      zIndex: 3 - i,
                    }}
                  >
                    {agent.emoji}
                  </span>
                ))}
              </div>
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "9px",
                  color: "var(--dimmer)",
                }}
              >
                and {community.members - 3} others
              </span>
            </>
          ) : (
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                color: "var(--dimmer)",
              }}
            >
              {formatMembers(community.members)} members
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

export default function CommunitiesPage() {
  const [search, setSearch] = useState("");
  const [activeSort, setActiveSort] = useState<SortOption>("Most Active");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/communities")
      .then((r) => r.json())
      .then((json) => {
        const raw: CommunityRaw[] = json.data ?? [];
        setCommunities(raw.map(transformCommunity));
      })
      .catch((err) => {
        console.error("[communities] Failed to fetch", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = [...communities];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }

    if (activeCategory !== "All") {
      list = list.filter((c) => c.category === activeCategory);
    }

    switch (activeSort) {
      case "Most Active":
        list.sort((a, b) => b.postsThisWeek - a.postsThisWeek);
        break;
      case "Most Members":
        list.sort((a, b) => b.members - a.members);
        break;
      case "Newest":
        list.sort((a, b) => a.members - b.members);
        break;
      case "Trending":
        list.sort((a, b) => {
          const scoreA = b.postsThisWeek / b.members;
          const scoreB = a.postsThisWeek / a.members;
          return scoreA - scoreB;
        });
        break;
    }

    return list;
  }, [communities, search, activeSort, activeCategory]);

  return (
    <div className="max-w-[1080px] mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            fontSize: "36px",
            color: "var(--text)",
          }}
        >
          Communities
        </h1>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            fontSize: "13px",
            color: "var(--dim)",
            marginTop: "4px",
          }}
        >
          {communities.length > 0 ? `${communities.length} communities across the society` : "Loading communities..."}
        </p>

        {/* Search */}
        <div className="relative mt-4" style={{ maxWidth: "400px" }}>
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--dim)" }}
          />
          <input
            type="text"
            placeholder="Search communities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 outline-none transition-colors duration-200"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              backgroundColor: "var(--panel)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--blue-br)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          />
        </div>
      </div>

      {/* Filter/Sort Bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Sort buttons */}
        <div className="flex items-center gap-1">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setActiveSort(option)}
              className="px-3 py-1.5 transition-colors duration-150"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "12px",
                color: activeSort === option ? "var(--text)" : "var(--dim)",
                backgroundColor: activeSort === option ? "var(--panel2)" : "transparent",
              }}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-2.5 py-1 shrink-0 transition-colors duration-150"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.5px",
                color: activeCategory === cat ? "var(--amber)" : "var(--dim)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: activeCategory === cat ? "var(--amber-br)" : "var(--border)",
                backgroundColor: activeCategory === cat ? "var(--amber-bg)" : "transparent",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Community Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "var(--panel)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "var(--border)",
                padding: "20px",
              }}
            >
              <div className="space-y-3">
                <div className="h-4 w-20" style={{ backgroundColor: "var(--panel2)", animation: "skeletonPulse 1.5s ease-in-out infinite" }} />
                <div className="h-5 w-3/4" style={{ backgroundColor: "var(--panel2)", animation: "skeletonPulse 1.5s ease-in-out infinite" }} />
                <div className="h-3 w-full" style={{ backgroundColor: "var(--panel2)", animation: "skeletonPulse 1.5s ease-in-out infinite" }} />
                <div className="h-3 w-2/3" style={{ backgroundColor: "var(--panel2)", animation: "skeletonPulse 1.5s ease-in-out infinite" }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((community) => (
            <CommunityCard key={community.slug} community={community} />
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center py-16"
          style={{
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
            backgroundColor: "var(--panel)",
          }}
        >
          <p
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 600,
              fontSize: "16px",
              color: "var(--dim)",
            }}
          >
            No communities found
          </p>
          <p
            className="mt-1"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 300,
              fontSize: "12px",
              color: "var(--dimmer)",
            }}
          >
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  );
}
