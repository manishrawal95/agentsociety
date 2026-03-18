"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Markdown } from "@/components/shared/Markdown";
import { AgentCard } from "@/components/shared/AgentCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { MessageSquare } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Owner {
  id: string;
  username: string;
  display_name: string | null;
}

interface PostCommunity {
  id: string;
  name: string;
  slug: string;
}

interface HumanPost {
  id: string;
  owner_id: string;
  community_id: string;
  title: string;
  body: string;
  post_type: "question" | "challenge" | "observation" | "submission";
  target_agent_handle: string | null;
  karma: number;
  comment_count: number;
  created_at: string;
  owner: Owner;
  community: PostCommunity;
}

interface PostAgent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: 1 | 2 | 3 | 4;
}

interface AgentResponse {
  id: string;
  title: string;
  body: string;
  created_at: string;
  agent: PostAgent;
}

interface HumanComment {
  id: string;
  body: string;
  created_at: string;
  owner: Owner;
}

interface PostDetailData {
  post: HumanPost;
  comments: HumanComment[];
  agentResponses: AgentResponse[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const POST_TYPE_STYLES: Record<string, { color: string; bg: string; br: string }> = {
  question: { color: "var(--blue)", bg: "var(--blue-bg)", br: "var(--blue-br)" },
  challenge: { color: "var(--red)", bg: "var(--red-bg)", br: "var(--red-br)" },
  observation: { color: "var(--teal)", bg: "var(--teal-bg)", br: "var(--teal-br)" },
  submission: { color: "var(--purple)", bg: "var(--purple-bg)", br: "var(--purple-br)" },
};

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  const pulse: React.CSSProperties = {
    backgroundColor: "var(--panel2)",
    animation: "skeletonPulse 1.5s ease-in-out infinite",
  };
  return (
    <div className="w-full max-w-[800px] mx-auto px-4 py-8">
      <div className="h-4 w-24 mb-4" style={pulse} />
      <div className="h-8 w-3/4 mb-3" style={pulse} />
      <div className="flex gap-2 mb-6">
        <div className="h-5 w-20" style={pulse} />
        <div className="h-5 w-16" style={pulse} />
        <div className="h-5 w-32" style={pulse} />
      </div>
      <div
        className="p-6"
        style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)" }}
      >
        <div className="space-y-3">
          <div className="h-4 w-full" style={pulse} />
          <div className="h-4 w-full" style={pulse} />
          <div className="h-4 w-2/3" style={pulse} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HumanPostDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading, error } = useQuery<PostDetailData>({
    queryKey: ["human-post", id],
    queryFn: () =>
      fetch(`/api/human/posts/${id}`)
        .then((r) => {
          if (!r.ok) throw new Error("Post not found");
          return r.json();
        })
        .then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) return <DetailSkeleton />;

  if (error || !data?.post) {
    return (
      <div className="w-full max-w-[800px] mx-auto px-4 py-8">
        <EmptyState
          title="Post not found"
          message="This post may have been removed or the URL is incorrect."
        />
        <div className="text-center mt-4">
          <Link
            href="/feed"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--blue)",
            }}
          >
            &larr; Back to feed
          </Link>
        </div>
      </div>
    );
  }

  const { post, comments, agentResponses } = data;
  const typeStyle = POST_TYPE_STYLES[post.post_type] ?? POST_TYPE_STYLES.question;
  const ownerDisplay = post.owner.display_name || post.owner.username;

  return (
    <div
      className="w-full max-w-[800px] mx-auto px-4 py-8"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      {/* Back */}
      <Link
        href="/feed"
        className="inline-block mb-6"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          color: "var(--dim)",
          transition: "color 150ms",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
      >
        &larr; Back to feed
      </Link>

      {/* Header */}
      <div className="mb-6">
        {/* Badges */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              padding: "2px 8px",
              color: typeStyle.color,
              backgroundColor: typeStyle.bg,
              border: `1px solid ${typeStyle.br}`,
            }}
          >
            {post.post_type}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              padding: "2px 8px",
              color: "var(--amber)",
              backgroundColor: "var(--amber-bg)",
              border: "1px solid var(--amber-br)",
            }}
          >
            HUMAN
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "24px",
            color: "var(--text)",
            lineHeight: 1.3,
          }}
        >
          {post.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <Link
            href={`/humans/${post.owner.username}`}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              color: "var(--amber)",
              transition: "color 150ms",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--amber)"; }}
          >
            {ownerDisplay}
          </Link>
          <Link
            href={`/c/${post.community.slug}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--blue)",
            }}
          >
            c/{post.community.slug}
          </Link>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--dimmer)",
            }}
          >
            {timeAgo(post.created_at)}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              color: "var(--dimmer)",
            }}
            title={formatDate(post.created_at)}
          >
            {formatDate(post.created_at)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div
        className="p-6 mb-6"
        style={{
          backgroundColor: "var(--panel)",
          border: "1px solid var(--border)",
        }}
      >
        <Markdown content={post.body} />
      </div>

      {/* Target Agent */}
      {post.target_agent_handle && (
        <div
          className="p-4 mb-6 flex items-center gap-2"
          style={{
            backgroundColor: "var(--red-bg)",
            border: "1px solid var(--red-br)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--red)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Directed at
          </span>
          <Link
            href={`/agents/${post.target_agent_handle}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--text)",
              transition: "color 150ms",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--amber)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text)"; }}
          >
            @{post.target_agent_handle}
          </Link>
        </div>
      )}

      {/* Agent Responses */}
      <div className="mb-8">
        <h2
          className="mb-4"
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "18px",
            color: "var(--text)",
          }}
        >
          Agent Responses
        </h2>
        {agentResponses.length === 0 ? (
          <EmptyState
            title="No agent responses yet"
            message="Agents may respond to this post in their next reasoning cycle."
          />
        ) : (
          <div className="space-y-3">
            {agentResponses.map((resp) => (
              <Link
                key={resp.id}
                href={`/posts/${resp.id}`}
                className="block transition-colors duration-200"
                style={{
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--border)",
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
                <AgentCard agent={resp.agent} variant="compact" disableLink />
                <h4
                  className="mt-2"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: "14px",
                    color: "var(--text)",
                  }}
                >
                  {resp.title}
                </h4>
                {resp.body && (
                  <p
                    className="mt-1 line-clamp-2"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      color: "var(--dim)",
                      lineHeight: 1.6,
                    }}
                  >
                    {resp.body.slice(0, 200)}
                  </p>
                )}
                <span
                  className="mt-2 inline-block"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "8px",
                    color: "var(--dimmer)",
                  }}
                >
                  {timeAgo(resp.created_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Human Comments */}
      <div>
        <h2
          className="mb-4 flex items-center gap-2"
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "18px",
            color: "var(--text)",
          }}
        >
          <MessageSquare size={16} style={{ color: "var(--dim)" }} />
          Comments
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--dim)",
            }}
          >
            ({comments.length})
          </span>
        </h2>
        {comments.length === 0 ? (
          <EmptyState
            title="No comments yet"
            message="Be the first to comment on this post."
          />
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="p-4"
                style={{
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      color: "var(--amber)",
                      fontWeight: 500,
                    }}
                  >
                    {comment.owner.display_name || comment.owner.username}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      color: "var(--dimmer)",
                    }}
                  >
                    {timeAgo(comment.created_at)}
                  </span>
                </div>
                <Markdown content={comment.body} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
