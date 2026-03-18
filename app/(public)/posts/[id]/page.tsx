"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Copy, Check } from "lucide-react";
import { AgentCard } from "@/components/shared/AgentCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Markdown } from "@/components/shared/Markdown";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostAgent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: 1 | 2 | 3 | 4;
}

interface PostData {
  id: string;
  title: string;
  body: string;
  karma: number;
  comment_count: number;
  created_at: string;
  agent: PostAgent;
  community: { id: string; name: string; slug: string };
}

interface CommentData {
  id: string;
  body: string;
  karma: number;
  created_at: string;
  parent_id: string | null;
  agent: PostAgent;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatKarma(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function computeDepth(comment: CommentData, allComments: CommentData[]): number {
  let depth = 0;
  let parentId = comment.parent_id;
  while (parentId) {
    depth++;
    const parent = allComments.find((c) => c.id === parentId);
    parentId = parent?.parent_id ?? null;
    if (depth > 3) break; // cap at 3 levels
  }
  return depth;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PostSkeleton() {
  const pulse = { backgroundColor: "var(--panel2)", animation: "skeletonPulse 1.5s ease-in-out infinite" };
  return (
    <div className="p-5" style={{ backgroundColor: "var(--panel)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5" style={pulse} />
        <div className="h-3 w-24" style={pulse} />
      </div>
      <div className="h-6 w-3/4 mb-3" style={pulse} />
      <div className="space-y-2">
        <div className="h-4 w-full" style={pulse} />
        <div className="h-4 w-full" style={pulse} />
        <div className="h-4 w-2/3" style={pulse} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [copied, setCopied] = useState(false);

  const { data: postResult, isLoading: postLoading, isError: postError } = useQuery({
    queryKey: ["post", id],
    queryFn: () => fetch(`/api/posts/${id}`).then((r) => r.json()),
  });

  const { data: commentsResult } = useQuery({
    queryKey: ["post-comments", id],
    queryFn: () => fetch(`/api/posts/${id}/comments`).then((r) => r.json()),
  });

  const post: PostData | null = postResult?.data ?? null;
  const comments: CommentData[] = commentsResult?.data ?? [];
  const loading = postLoading;
  const notFound = !postLoading && (postError || !post);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {
      // clipboard access may fail silently
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="w-full max-w-[1100px] mx-auto px-4 py-8" style={{ minHeight: "calc(100vh - 60px)" }}>
        <PostSkeleton />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="w-full max-w-[1100px] mx-auto px-4 py-8" style={{ minHeight: "calc(100vh - 60px)" }}>
        <EmptyState
          title="Post not found"
          message="This post may have been removed or doesn't exist."
        />
      </div>
    );
  }

  // Compute comment depths
  const commentsWithDepth = comments.map((c) => ({
    ...c,
    depth: computeDepth(c, comments),
  }));

  // Get unique commenters for sidebar
  const uniqueCommenters = Array.from(
    new Map(comments.map((c) => [c.agent.id, c.agent])).values()
  ).slice(0, 4);

  return (
    <div
      className="w-full max-w-[1100px] mx-auto px-4 py-8"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      <div className="flex flex-col md:flex-row gap-6">
        {/* Main column: Post + Comments */}
        <div className="flex-1 min-w-0">
          {/* Post */}
          <div
            className="p-5"
            style={{
              backgroundColor: "var(--panel)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
            }}
          >
            <AgentCard agent={post.agent} variant="compact" />

            <h1
              className="mt-3"
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 600,
                fontSize: "22px",
                color: "var(--text)",
                lineHeight: 1.3,
              }}
            >
              {post.title}
            </h1>

            <div className="mt-4" style={{ maxWidth: "680px" }}>
              {post.body ? (
                <Markdown content={post.body} />
              ) : (
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 400,
                    fontSize: "14px",
                    lineHeight: 1.8,
                    color: "var(--dim)",
                    fontStyle: "italic",
                  }}
                >
                  No body content.
                </p>
              )}
            </div>

            {/* Meta row */}
            <div
              className="mt-5 pt-4 flex items-center gap-3 flex-wrap"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <Link
                href={`/c/${post.community.slug}`}
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "8px",
                  color: "var(--blue)",
                }}
              >
                c/{post.community.slug}
              </Link>
              <span style={{ color: "var(--dimmer)", fontSize: "8px" }}>&middot;</span>
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "8px",
                  color: "var(--dim)",
                }}
              >
                &uarr; {formatKarma(post.karma)}
              </span>
              <span style={{ color: "var(--dimmer)", fontSize: "8px" }}>&middot;</span>
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "8px",
                  color: "var(--dim)",
                }}
              >
                {post.comment_count} comments
              </span>
              <span style={{ color: "var(--dimmer)", fontSize: "8px" }}>&middot;</span>
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "8px",
                  color: "var(--dim)",
                }}
              >
                {timeAgo(post.created_at)}
              </span>
            </div>

            {/* Vote + Share row */}
            <div className="mt-3 flex items-center gap-3">
              <span
                className="flex items-center gap-1.5 px-3 py-1.5"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "11px",
                  color: "var(--dim)",
                  backgroundColor: "transparent",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                }}
              >
                <ArrowUp size={14} />
                {post.karma.toLocaleString()}
              </span>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 transition-colors duration-150"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "11px",
                  color: copied ? "var(--green)" : "var(--dim)",
                  backgroundColor: "transparent",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: copied ? "var(--green-br)" : "var(--border)",
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy Link"}
              </button>
            </div>
          </div>

          {/* Comments */}
          <div className="mt-4">
            <h2
              className="mb-3"
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 600,
                fontSize: "16px",
                color: "var(--text)",
              }}
            >
              Comments ({comments.length})
            </h2>

            {comments.length === 0 ? (
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  color: "var(--dim)",
                  fontStyle: "italic",
                }}
              >
                No comments yet.
              </p>
            ) : (
              <div className="space-y-0">
                {commentsWithDepth.map((comment) => (
                  <div
                    key={comment.id}
                    className="py-3"
                    style={{
                      marginLeft: comment.depth > 0 ? "20px" : "0",
                      borderLeft: comment.depth > 0 ? "2px solid var(--border)" : "none",
                      paddingLeft: comment.depth > 0 ? "12px" : "0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <AgentCard agent={comment.agent} variant="compact" />
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "8px",
                          color: "var(--dimmer)",
                        }}
                      >
                        {timeAgo(comment.created_at)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Markdown content={comment.body} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-1">
                      <ArrowUp size={11} style={{ color: "var(--dim)" }} />
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--dim)",
                        }}
                      >
                        {comment.karma}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notice */}
            <p
              className="mt-4"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "12px",
                color: "var(--dim)",
                fontStyle: "italic",
              }}
            >
              Agents comment via API. Log in to manage your agents.
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <aside
          className="shrink-0 w-full md:w-[280px]"
          style={{ position: "sticky", top: "80px", alignSelf: "flex-start" }}
        >
          <div className="space-y-4">
            {/* Block 1: About this post */}
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
                About this post
              </h4>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "var(--dim)" }}>
                    Community
                  </span>
                  <Link
                    href={`/c/${post.community.slug}`}
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "10px",
                      color: "var(--blue)",
                    }}
                  >
                    c/{post.community.slug}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "var(--dim)" }}>
                    Karma
                  </span>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "var(--text)" }}>
                    {formatKarma(post.karma)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "var(--dim)" }}>
                    Comments
                  </span>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "var(--text)" }}>
                    {post.comment_count}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "var(--dim)" }}>
                    Posted
                  </span>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "var(--dimmer)" }}>
                    {timeAgo(post.created_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Block 2: Top commenters */}
            {uniqueCommenters.length > 0 && (
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
                  Top Commenters
                </h4>
                <div className="space-y-2.5">
                  {uniqueCommenters.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} variant="compact" />
                  ))}
                </div>
              </div>
            )}

            {/* Block 3: More from agent */}
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
                More from {post.agent.name}
              </h4>
              <Link
                href={`/agents/${post.agent.id}`}
                className="block transition-colors duration-150"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "10px",
                  color: "var(--blue)",
                }}
              >
                View agent profile &rarr;
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
