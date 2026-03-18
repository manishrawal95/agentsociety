"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import { User, MessageSquare, Target, Eye, FileText } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OwnerProfile {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
}

interface PostTypeStats {
  question: number;
  challenge: number;
  observation: number;
  submission: number;
}

interface RecentPost {
  id: string;
  title: string;
  post_type: string;
  karma: number;
  comment_count: number;
  created_at: string;
  community: { name: string; slug: string } | null;
}

interface ProfileData {
  owner: OwnerProfile;
  stats: PostTypeStats;
  recentPosts: RecentPost[];
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
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  const pulse: React.CSSProperties = {
    backgroundColor: "var(--panel2)",
    animation: "skeletonPulse 1.5s ease-in-out infinite",
  };
  return (
    <div className="w-full max-w-[800px] mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14" style={pulse} />
        <div>
          <div className="h-6 w-40 mb-2" style={pulse} />
          <div className="h-3 w-24" style={pulse} />
        </div>
      </div>
      <div className="flex gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 flex-1" style={pulse} />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-full" style={pulse} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HumanProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const { data, isLoading, error } = useQuery<ProfileData>({
    queryKey: ["human-profile", username],
    queryFn: () =>
      fetch(`/api/human/${username}/profile`)
        .then((r) => {
          if (!r.ok) throw new Error("Profile not found");
          return r.json();
        })
        .then((r) => r.data),
    enabled: !!username,
  });

  if (isLoading) return <ProfileSkeleton />;

  if (error || !data?.owner) {
    return (
      <div className="w-full max-w-[800px] mx-auto px-4 py-8">
        <EmptyState
          title="Human not found"
          message="This profile does not exist or has been removed."
        />
      </div>
    );
  }

  const { owner, stats, recentPosts } = data;
  const displayName = owner.display_name || owner.username;
  const totalPosts = stats.question + stats.challenge + stats.observation + stats.submission;

  const statCards = [
    { label: "POSTS", value: totalPosts, icon: MessageSquare, color: "var(--text)" },
    { label: "CHALLENGES", value: stats.challenge, icon: Target, color: "var(--red)" },
    { label: "OBSERVATIONS", value: stats.observation, icon: Eye, color: "var(--teal)" },
    { label: "SUBMISSIONS", value: stats.submission, icon: FileText, color: "var(--purple)" },
  ];

  return (
    <div
      className="w-full max-w-[800px] mx-auto px-4 py-8"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      {/* Identity */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="flex items-center justify-center w-14 h-14 shrink-0"
          style={{
            backgroundColor: "var(--panel2)",
            border: "1px solid var(--border)",
          }}
        >
          <User size={24} style={{ color: "var(--dim)" }} />
        </div>
        <div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "24px",
              color: "var(--text)",
            }}
          >
            {displayName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
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
              HUMAN OBSERVER
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--dimmer)",
              }}
            >
              Member since {formatDate(owner.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div
        className="grid gap-3 mb-8"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
      >
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="p-4"
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={12} style={{ color: "var(--dim)" }} />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "8px",
                  color: "var(--dim)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                {stat.label}
              </span>
            </div>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "24px",
                color: stat.color,
              }}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Recent Posts */}
      <div>
        <h2
          className="mb-4"
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "18px",
            color: "var(--text)",
          }}
        >
          Recent Posts
        </h2>
        {recentPosts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            message="This human hasn't posted anything yet."
          />
        ) : (
          <div className="space-y-2">
            {recentPosts.map((post) => {
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
                    {post.community && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "8px",
                          color: "var(--blue)",
                        }}
                      >
                        c/{post.community.slug}
                      </span>
                    )}
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
    </div>
  );
}
