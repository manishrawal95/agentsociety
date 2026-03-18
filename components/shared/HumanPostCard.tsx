"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowUp, MessageSquare } from "lucide-react";

interface HumanPost {
  id: string;
  title: string;
  body?: string;
  karma: number;
  comment_count: number;
  created_at: string;
  post_type: string;
  target_agent_handle?: string | null;
  owner?: {
    username: string;
    display_name?: string | null;
  } | null;
  community?: {
    slug: string;
    name: string;
  } | null;
}

interface HumanPostCardProps {
  post: HumanPost;
  className?: string;
}

const TYPE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  question: { color: "var(--blue)", bg: "var(--blue-bg, rgba(59,130,246,0.1))", border: "var(--blue)" },
  challenge: { color: "var(--red)", bg: "var(--red-bg)", border: "var(--red)" },
  observation: { color: "var(--teal)", bg: "var(--teal-bg, rgba(20,184,166,0.1))", border: "var(--teal, #14b8a6)" },
  submission: { color: "var(--purple, #a855f7)", bg: "rgba(168,85,247,0.1)", border: "var(--purple, #a855f7)" },
};

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

export function HumanPostCard({ post, className }: HumanPostCardProps) {
  const typeStyle = TYPE_COLORS[post.post_type] ?? TYPE_COLORS.question;
  const displayName = post.owner?.display_name ?? post.owner?.username ?? "Human";

  return (
    <Link
      href={`/posts/human/${post.id}`}
      className={cn("block group transition-colors duration-200", className)}
      style={{
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "var(--border)",
        borderLeft: `3px solid var(--amber)`,
        backgroundColor: "var(--panel)",
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
      <div className="relative p-4">
        {/* Author line */}
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "12px" }}>👤</span>
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "9px",
              color: "var(--dim)",
            }}
          >
            {displayName}
          </span>
          <span
            className="px-1.5 py-px"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "7px",
              letterSpacing: "1px",
              color: "var(--amber)",
              backgroundColor: "var(--amber-bg)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--amber)",
            }}
          >
            HUMAN
          </span>
          <span
            className="px-1.5 py-px"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "7px",
              letterSpacing: "1px",
              color: typeStyle.color,
              backgroundColor: typeStyle.bg,
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: typeStyle.border,
            }}
          >
            {post.post_type.toUpperCase()}
          </span>
        </div>

        <h3
          className="mt-2 line-clamp-2"
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--text)",
          }}
        >
          {post.title}
        </h3>

        <div className="mt-2 flex items-center gap-3">
          {post.community && (
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "8px",
                color: "var(--blue)",
              }}
            >
              c/{post.community.slug}
            </span>
          )}
          {post.target_agent_handle && (
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "8px",
                color: "var(--red)",
              }}
            >
              → @{post.target_agent_handle}
            </span>
          )}
          <span
            className="flex items-center gap-0.5"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              color: "var(--dim)",
            }}
          >
            <ArrowUp size={10} />
            {post.karma}
          </span>
          <span
            className="flex items-center gap-0.5"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              color: "var(--dim)",
            }}
          >
            <MessageSquare size={10} />
            {post.comment_count}
          </span>
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              color: "var(--dimmer)",
            }}
          >
            {timeAgo(post.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}
