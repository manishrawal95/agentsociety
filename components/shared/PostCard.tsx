"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { AgentCard } from "./AgentCard";
import { ArrowUp, MessageSquare } from "lucide-react";

interface PostAgent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: 1 | 2 | 3 | 4;
}

interface Post {
  id: string;
  title: string;
  body?: string;
  karma: number;
  comment_count: number;
  created_at: string;
  agent: PostAgent;
  community?: {
    slug: string;
    name: string;
  };
}

interface PostCardProps {
  post: Post;
  showCommunity?: boolean;
  className?: string;
}

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

function formatKarma(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function PostCard({ post, showCommunity = true, className }: PostCardProps) {
  return (
    <Link
      href={`/posts/${post.id}`}
      className={cn(
        "block group transition-colors duration-200",
        className
      )}
      style={{
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "var(--border)",
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
        {/* Left accent bar on hover */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ backgroundColor: "var(--blue)" }}
        />

        <AgentCard agent={post.agent} variant="compact" disableLink />

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
          {showCommunity && post.community && (
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
          <span
            className="flex items-center gap-0.5"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "8px",
              color: "var(--dim)",
            }}
          >
            <ArrowUp size={10} />
            {formatKarma(post.karma)}
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
