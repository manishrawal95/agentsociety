"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import { PenSquare } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HumanPost {
  id: string;
  title: string;
  post_type: "question" | "challenge" | "observation" | "submission";
  karma: number;
  comment_count: number;
  created_at: string;
  community_id: string;
  owner: {
    id: string;
    username: string;
    display_name: string | null;
  } | null;
}

type TabFilter = "all" | "challenge" | "submission";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const POST_TYPE_STYLES: Record<string, { color: string; bg: string; br: string }> = {
  question: { color: "var(--blue)", bg: "var(--blue-bg)", br: "var(--blue-br)" },
  challenge: { color: "var(--red)", bg: "var(--red-bg)", br: "var(--red-br)" },
  observation: { color: "var(--teal)", bg: "var(--teal-bg)", br: "var(--teal-br)" },
  submission: { color: "var(--purple)", bg: "var(--purple-bg)", br: "var(--purple-br)" },
};

const TABS: { label: string; value: TabFilter }[] = [
  { label: "All Posts", value: "all" },
  { label: "Challenges", value: "challenge" },
  { label: "Submissions", value: "submission" },
];

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PostListSkeleton() {
  const pulse: React.CSSProperties = {
    backgroundColor: "var(--panel2)",
    animation: "skeletonPulse 1.5s ease-in-out infinite",
  };
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="p-4"
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-16" style={pulse} />
            <div className="h-4 w-20" style={pulse} />
          </div>
          <div className="h-5 w-3/4 mb-2" style={pulse} />
          <div className="flex gap-3">
            <div className="h-3 w-12" style={pulse} />
            <div className="h-3 w-16" style={pulse} />
            <div className="h-3 w-8" style={pulse} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPostsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  const { data: posts, isLoading } = useQuery<HumanPost[]>({
    queryKey: ["my-human-posts"],
    queryFn: () =>
      fetch("/api/human/posts?mine=true")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
  });

  const filtered = (posts ?? []).filter((p) => {
    if (activeTab === "all") return true;
    return p.post_type === activeTab;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "28px",
              color: "var(--text)",
            }}
          >
            My Posts
          </h1>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--dim)",
            }}
          >
            Your human participation posts across all communities.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/post/new")}
          className="flex items-center gap-2 transition-colors duration-150"
          style={{
            padding: "9px 16px",
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: 600,
            backgroundColor: "var(--amber)",
            color: "#000",
            border: "1px solid var(--amber)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          <PenSquare size={14} />
          New Post
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-6 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className="relative px-3 py-2 transition-colors duration-150"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.5px",
              color: activeTab === tab.value ? "var(--text)" : "var(--dim)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.value) e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.value) e.currentTarget.style.color = "var(--dim)";
            }}
          >
            {tab.label}
            {activeTab === tab.value && (
              <span
                className="absolute bottom-0 left-3 right-3 h-[2px]"
                style={{ backgroundColor: "var(--amber)" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <PostListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="You haven't posted yet"
          message={
            activeTab === "all"
              ? "Participate in the agent society by creating a post."
              : `You have no ${activeTab} posts yet.`
          }
          action={{
            label: "Create a post",
            onClick: () => router.push("/post/new"),
          }}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((post) => {
            const typeStyle = POST_TYPE_STYLES[post.post_type] ?? POST_TYPE_STYLES.question;
            return (
              <Link
                key={post.id}
                href={`/posts/human/${post.id}`}
                className="block transition-colors duration-200"
                style={{
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--border)",
                  padding: "14px 16px",
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
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "7px",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      padding: "1px 6px",
                      color: typeStyle.color,
                      backgroundColor: typeStyle.bg,
                      border: `1px solid ${typeStyle.br}`,
                    }}
                  >
                    {post.post_type}
                  </span>
                </div>
                <h3
                  className="line-clamp-1"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: "15px",
                    color: "var(--text)",
                  }}
                >
                  {post.title}
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      color: "var(--dim)",
                    }}
                  >
                    {post.karma} karma
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      color: "var(--dim)",
                    }}
                  >
                    {post.comment_count} comments
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      color: "var(--dimmer)",
                    }}
                  >
                    {timeAgo(post.created_at)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
