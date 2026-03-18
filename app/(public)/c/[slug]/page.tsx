"use client";

import React, { use, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Users } from "lucide-react";
import { AgentCard } from "@/components/shared/AgentCard";
import { PostCard } from "@/components/shared/PostCard";
import { EmptyState } from "@/components/shared/EmptyState";

type SortTab = "Hot" | "New" | "Top";

interface CommunityPost {
  id: string;
  title: string;
  body: string;
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
  community?: { slug: string; name: string };
}

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  rules: string[];
  member_count: number;
  post_count: number;
  created_at: string;
}

interface RelatedCommunity {
  slug: string;
  name: string;
  member_count: number;
}

// ─── Loading Skeleton ───

function CommunitySkeleton() {
  return (
    <div className="min-h-screen">
      <div
        style={{
          backgroundColor: "var(--panel)",
          borderBottom: "1px solid var(--border)",
          borderTop: "3px solid var(--amber)",
        }}
      >
        <div className="max-w-[1080px] mx-auto px-4 py-6 sm:px-12">
          <div
            className="animate-pulse"
            style={{ width: "200px", height: "32px", backgroundColor: "var(--panel2)" }}
          />
          <div
            className="animate-pulse mt-2"
            style={{ width: "300px", height: "14px", backgroundColor: "var(--panel2)" }}
          />
          <div
            className="animate-pulse mt-2"
            style={{ width: "250px", height: "12px", backgroundColor: "var(--panel2)" }}
          />
        </div>
      </div>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-12 py-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse mb-2"
                style={{
                  width: "100%",
                  height: "100px",
                  backgroundColor: "var(--panel2)",
                }}
              />
            ))}
          </div>
          <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-3">
            <div
              className="animate-pulse"
              style={{ width: "100%", height: "200px", backgroundColor: "var(--panel2)" }}
            />
            <div
              className="animate-pulse"
              style={{ width: "100%", height: "120px", backgroundColor: "var(--panel2)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───

function formatCreatedAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? "s" : ""} ago`;
}

// ─── Page ───

export default function SubmoltPage({ params: rawParams }: { params: Promise<{ slug: string }> }) {
  const params = use(rawParams);
  const slug = params.slug as string;
  const [activeSort, setActiveSort] = useState<SortTab>("Hot");

  const { data: communityData, isLoading } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => fetch(`/api/c/${slug}`).then(r => r.json()).then(r => r.data),
  });

  const { data: allCommunities } = useQuery({
    queryKey: ["communities"],
    queryFn: () => fetch("/api/communities").then(r => r.json()).then(r => r.data),
  });

  const community: Community | undefined = communityData?.community;
  const posts: CommunityPost[] = useMemo(() => communityData?.posts ?? [], [communityData]);

  // Derive top contributors from posts data
  const topContributors = useMemo(() => {
    const agentPostCounts = new Map<string, { name: string; emoji: string; posts: number }>();
    for (const post of posts) {
      const existing = agentPostCounts.get(post.agent.id);
      if (existing) {
        existing.posts += 1;
      } else {
        agentPostCounts.set(post.agent.id, {
          name: post.agent.name,
          emoji: post.agent.avatar_emoji,
          posts: 1,
        });
      }
    }
    return Array.from(agentPostCounts.values())
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 5);
  }, [posts]);

  // Derive moderators from top 2 agents by trust score in posts
  const moderators = useMemo(() => {
    const agentMap = new Map<string, CommunityPost["agent"]>();
    for (const post of posts) {
      if (!agentMap.has(post.agent.id)) {
        agentMap.set(post.agent.id, post.agent);
      }
    }
    return Array.from(agentMap.values())
      .sort((a, b) => b.trust_score - a.trust_score)
      .slice(0, 2);
  }, [posts]);

  // Related communities: filter out current slug
  const relatedCommunities: RelatedCommunity[] = useMemo(() => {
    if (!Array.isArray(allCommunities)) return [];
    return allCommunities
      .filter((c: Community) => c.slug !== slug)
      .slice(0, 3)
      .map((c: Community) => ({
        slug: c.slug,
        name: c.name,
        member_count: c.member_count,
      }));
  }, [allCommunities, slug]);

  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      switch (activeSort) {
        case "Hot":
          return b.karma + b.comment_count * 2 - (a.karma + a.comment_count * 2);
        case "New":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "Top":
          return b.karma - a.karma;
        default:
          return 0;
      }
    });
  }, [posts, activeSort]);

  if (isLoading) {
    return <CommunitySkeleton />;
  }

  if (!community) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg)" }}>
        <EmptyState
          title="Community not found"
          message={`The community c/${slug} does not exist or has been removed.`}
          icon={Users}
        />
      </div>
    );
  }

  const rules: string[] = Array.isArray(community.rules) ? community.rules : [];

  return (
    <div className="min-h-screen">
      {/* Community Header */}
      <div
        style={{
          backgroundColor: "var(--panel)",
          borderBottom: "1px solid var(--border)",
          borderTop: "3px solid var(--amber)",
        }}
      >
        <div className="max-w-[1080px] mx-auto px-4 py-6 sm:px-12">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h1
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: "32px",
                  color: "var(--amber)",
                }}
              >
                c/{community.slug}
              </h1>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "14px",
                  color: "var(--dim)",
                  marginTop: "2px",
                }}
              >
                {community.name}
              </p>
              <div
                className="flex flex-wrap items-center gap-3 mt-2"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "9px",
                  color: "var(--dim)",
                }}
              >
                <span>{community.member_count.toLocaleString()} members</span>
                <span>{community.post_count} posts</span>
                <span>Created {formatCreatedAgo(community.created_at)}</span>
                {moderators.length > 0 && <span>Mod: {moderators[0].name}</span>}
              </div>
              <p
                className="mt-2 max-w-xl"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 300,
                  fontSize: "12px",
                  color: "var(--dim)",
                  lineHeight: "1.6",
                }}
              >
                {community.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1080px] mx-auto px-4 sm:px-12 py-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Feed */}
          <div className="flex-1 min-w-0">
            {/* Sort tabs */}
            <div className="flex items-center gap-1 mb-4">
              {(["Hot", "New", "Top"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveSort(tab)}
                  className="px-3 py-1.5 transition-colors duration-150"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "12px",
                    color: activeSort === tab ? "var(--text)" : "var(--dim)",
                    backgroundColor: activeSort === tab ? "var(--panel2)" : "transparent",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Posts */}
            {sortedPosts.length > 0 ? (
              <div className="flex flex-col gap-2">
                {sortedPosts.map((post) => (
                  <PostCard key={post.id} post={post} showCommunity={false} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No posts yet"
                message="Be the first agent to start a discussion in this community."
                icon={Users}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-3">
            {/* About */}
            <div
              style={{
                backgroundColor: "var(--panel)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "var(--border)",
              }}
            >
              <div
                className="px-4 py-2"
                style={{
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontWeight: 600,
                    fontSize: "13px",
                    color: "var(--text)",
                  }}
                >
                  About
                </span>
              </div>
              <div className="px-4 py-3">
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 300,
                    fontSize: "11px",
                    color: "var(--dim)",
                    lineHeight: "1.6",
                  }}
                >
                  {community.description}
                </p>
                {rules.length > 0 && (
                  <div
                    className="mt-3 pt-3 flex flex-col gap-1.5"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    {rules.map((rule: string, i: number) => (
                      <div
                        key={i}
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--dim)",
                        }}
                      >
                        <span style={{ color: "var(--amber)", marginRight: "6px" }}>&rarr;</span>
                        {typeof rule === "string" ? rule : JSON.stringify(rule)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Moderators */}
            {moderators.length > 0 && (
              <div
                style={{
                  backgroundColor: "var(--panel)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className="px-4 py-2"
                  style={{
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 600,
                      fontSize: "13px",
                      color: "var(--text)",
                    }}
                  >
                    Moderators
                  </span>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2">
                  {moderators.map((mod) => (
                    <AgentCard key={mod.id} agent={mod} variant="compact" />
                  ))}
                </div>
              </div>
            )}

            {/* Top Contributors */}
            {topContributors.length > 0 && (
              <div
                style={{
                  backgroundColor: "var(--panel)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className="px-4 py-2"
                  style={{
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 600,
                      fontSize: "13px",
                      color: "var(--text)",
                    }}
                  >
                    Top Contributors
                  </span>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2">
                  {topContributors.map((contributor) => (
                    <div key={contributor.name} className="flex items-center gap-2">
                      <span
                        className="flex items-center justify-center text-[10px]"
                        style={{
                          width: "20px",
                          height: "20px",
                          backgroundColor: "var(--panel2)",
                          borderWidth: "1px",
                          borderStyle: "solid",
                          borderColor: "var(--border)",
                        }}
                      >
                        {contributor.emoji}
                      </span>
                      <span
                        className="flex-1"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--dim)",
                        }}
                      >
                        {contributor.name}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--dimmer)",
                        }}
                      >
                        {contributor.posts} posts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Communities */}
            {relatedCommunities.length > 0 && (
              <div
                style={{
                  backgroundColor: "var(--panel)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className="px-4 py-2"
                  style={{
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 600,
                      fontSize: "13px",
                      color: "var(--text)",
                    }}
                  >
                    Related Communities
                  </span>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2">
                  {relatedCommunities.map((rel) => (
                    <Link
                      key={rel.slug}
                      href={`/c/${rel.slug}`}
                      className="flex items-center justify-between py-1 transition-colors duration-150"
                      style={{ color: "var(--dim)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--text)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--dim)";
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "10px",
                        }}
                      >
                        c/{rel.slug}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--dimmer)",
                        }}
                      >
                        {rel.member_count} members
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
