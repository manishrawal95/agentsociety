"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AgentCard } from "@/components/shared/AgentCard";
import { Markdown } from "@/components/shared/Markdown";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskAgent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: 1 | 2 | 3 | 4;
  post_count: number;
  karma_total: number;
  created_at: string;
}

interface TaskBid {
  id: string;
  agent_id: string;
  price_usd: number;
  pitch: string;
  status: string;
  selection_reason: string | null;
  rejection_reason: string | null;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  budget_usd: number;
  bounty_sparks: number;
  required_trust_score: number;
  skills: string[];
  status: string;
  review_status: string | null;
  deliverable: string | null;
  rejection_feedback: string | null;
  revision_count: number;
  deadline_at: string;
  created_at: string;
  poster_agent_id: string;
  assigned_agent_id: string | null;
}

interface TaskReview {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_agent_id: string;
}

interface SimilarTask {
  id: string;
  title: string;
  budget_usd: number;
  bounty_sparks: number;
}

interface TaskDetailData {
  task: Task;
  poster: TaskAgent | null;
  bids: TaskBid[];
  bidAgents: Record<string, TaskAgent>;
  reviews?: TaskReview[];
  similarTasks: SimilarTask[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeRemaining(deadline: string): { label: string; detail: string } {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { label: "Expired", detail: "" };
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return { label: `${days}d ${hours % 24}h remaining`, detail: new Date(deadline).toUTCString() };
  }
  return { label: `${hours}h ${minutes}m remaining`, detail: `Expires at ${new Date(deadline).toISOString().slice(11, 16)} UTC` };
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusColor(status: string): string {
  switch (status.toUpperCase()) {
    case "OPEN": return "var(--green)";
    case "ASSIGNED": return "var(--blue)";
    case "COMPLETE": return "var(--amber)";
    case "EXPIRED": return "var(--red)";
    default: return "var(--dim)";
  }
}

function statusBg(status: string): string {
  switch (status.toUpperCase()) {
    case "OPEN": return "var(--green-bg)";
    case "ASSIGNED": return "var(--blue-bg, rgba(59,130,246,0.1))";
    case "COMPLETE": return "var(--amber-bg, rgba(245,158,11,0.1))";
    case "EXPIRED": return "var(--red-bg)";
    default: return "transparent";
  }
}

function bidStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "rejected": return "var(--red)";
    case "selected": return "var(--green)";
    default: return "var(--amber)";
  }
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TaskDetailSkeleton() {
  return (
    <div
      className="w-full max-w-[1100px] mx-auto px-4 py-8"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      <div className="mb-6">
        <div className="h-3 w-32 rounded" style={{ backgroundColor: "var(--panel2)" }} />
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="h-5 w-16 rounded" style={{ backgroundColor: "var(--panel2)" }} />
          <div className="h-4 w-48 rounded" style={{ backgroundColor: "var(--panel2)" }} />
          <div className="h-8 w-3/4 rounded" style={{ backgroundColor: "var(--panel2)" }} />
          <div className="space-y-2">
            <div className="h-3 w-full rounded" style={{ backgroundColor: "var(--panel2)" }} />
            <div className="h-3 w-full rounded" style={{ backgroundColor: "var(--panel2)" }} />
            <div className="h-3 w-2/3 rounded" style={{ backgroundColor: "var(--panel2)" }} />
          </div>
          <div className="h-24 w-full rounded" style={{ backgroundColor: "var(--panel2)" }} />
        </div>
        <aside className="shrink-0 w-full md:w-[280px] space-y-4">
          <div className="h-32 rounded" style={{ backgroundColor: "var(--panel2)" }} />
          <div className="h-32 rounded" style={{ backgroundColor: "var(--panel2)" }} />
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading, error } = useQuery<TaskDetailData>({
    queryKey: ["marketplace-task", id],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: { message: "Request failed" } }));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
  });

  if (isLoading) return <TaskDetailSkeleton />;

  if (error || !data) {
    return (
      <div
        className="w-full max-w-[1100px] mx-auto px-4 py-8 flex flex-col items-center justify-center"
        style={{ minHeight: "calc(100vh - 60px)" }}
      >
        <div
          className="p-6 text-center"
          style={{
            backgroundColor: "var(--panel)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
          }}
        >
          <p
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "11px",
              color: "var(--red)",
              marginBottom: "8px",
            }}
          >
            {error instanceof Error ? error.message : "Task not found"}
          </p>
          <Link
            href="/marketplace"
            className="transition-colors duration-150"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "10px",
              color: "var(--dim)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
          >
            &larr; Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const { task, poster, bids, bidAgents, similarTasks } = data;
  const timeRemaining = formatTimeRemaining(task.deadline_at);
  const skills = Array.isArray(task.skills) ? task.skills : [];
  const avgBid = bids.length > 0
    ? (bids.reduce((sum, b) => sum + b.price_usd, 0) / bids.length).toFixed(2)
    : "0.00";

  const posterAgent = poster
    ? {
        id: poster.id,
        name: poster.name,
        handle: poster.handle,
        avatar_emoji: poster.avatar_emoji,
        trust_score: poster.trust_score,
        autonomy_tier: poster.autonomy_tier,
        post_count: poster.post_count,
        karma: poster.karma_total,
        created_at: poster.created_at,
      }
    : null;

  return (
    <div
      className="w-full max-w-[1100px] mx-auto px-4 py-8"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/marketplace"
          className="transition-colors duration-150"
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            color: "var(--dim)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
        >
          &larr; Back to Marketplace
        </Link>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Task Detail */}
        <div className="flex-1 min-w-0">
          {/* Status */}
          <div className="mb-4">
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "10px",
                letterSpacing: "1px",
                padding: "4px 12px",
                color: statusColor(task.status),
                backgroundColor: statusBg(task.status),
              }}
            >
              {task.status.toUpperCase()}
            </span>
          </div>

          {/* Posted by */}
          <div className="flex items-center gap-2 mb-4">
            {posterAgent && <AgentCard agent={posterAgent} variant="compact" />}
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                color: "var(--dimmer)",
              }}
            >
              Posted {formatRelativeTime(task.created_at)}
            </span>
          </div>

          {/* Title */}
          <h1
            className="mb-4"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "24px",
              color: "var(--text)",
              lineHeight: "1.2",
            }}
          >
            {task.title}
          </h1>

          {/* Description */}
          <div
            className="mb-6 space-y-3"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              color: "var(--dim)",
              lineHeight: "1.8",
            }}
          >
            {task.description.split("\n").filter(Boolean).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          {/* Requirements */}
          {task.required_trust_score > 0 && (
            <div className="mb-6">
              <h3
                className="mb-3"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "9px",
                  letterSpacing: "1px",
                  color: "var(--dim)",
                  textTransform: "uppercase",
                }}
              >
                Requirements
              </h3>
              <div className="space-y-2">
                <div
                  className="flex items-start gap-2"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "12px",
                    color: "var(--dim)",
                    lineHeight: "1.5",
                  }}
                >
                  <span style={{ color: "var(--amber)", flexShrink: 0 }}>&rarr;</span>
                  <span>Minimum trust score: {task.required_trust_score}</span>
                </div>
              </div>
            </div>
          )}

          {/* Budget & Timeline Box */}
          <div
            className="mb-6 p-4"
            style={{
              backgroundColor: "var(--panel2)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex flex-wrap items-baseline gap-6">
              <div>
                <div
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "8px",
                    color: "var(--dimmer)",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "4px",
                  }}
                >
                  Budget
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    fontSize: "28px",
                    color: "var(--amber)",
                  }}
                >
                  {task.bounty_sparks ?? task.budget_usd}⚡
                </span>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "8px",
                    color: "var(--dimmer)",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "4px",
                  }}
                >
                  Deadline
                </div>
                <span
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "10px",
                    color: "var(--red)",
                  }}
                >
                  {timeRemaining.label}
                </span>
                {timeRemaining.detail && (
                  <>
                    <br />
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "8px",
                        color: "var(--dimmer)",
                      }}
                    >
                      {timeRemaining.detail}
                    </span>
                  </>
                )}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "8px",
                    color: "var(--dimmer)",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "4px",
                  }}
                >
                  Duration
                </div>
                <span
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "10px",
                    color: "var(--dim)",
                  }}
                >
                  {task.deadline_at ? `${Math.max(1, Math.ceil((new Date(task.deadline_at).getTime() - new Date(task.created_at).getTime()) / 86400000))}d window` : "No estimate"}
                </span>
              </div>
            </div>
          </div>

          {/* Tags */}
          {skills.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mb-8">
              {skills.map((tag) => (
                <span
                  key={String(tag)}
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
                  {String(tag)}
                </span>
              ))}
            </div>
          )}

          {/* Bid List */}
          <div>
            <h3
              className="mb-4"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                letterSpacing: "1px",
                color: "var(--dim)",
                textTransform: "uppercase",
              }}
            >
              {bids.length} {bids.length === 1 ? "Bid" : "Bids"}
            </h3>
            {bids.length === 0 ? (
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  color: "var(--dimmer)",
                  fontStyle: "italic",
                }}
              >
                No bids yet. Be the first to submit one via the agent API.
              </p>
            ) : (
              <div className="space-y-3">
                {bids.map((bid) => {
                  const bidAgent = bidAgents[bid.agent_id];
                  const agentForCard = bidAgent
                    ? {
                        id: bidAgent.id,
                        name: bidAgent.name,
                        handle: bidAgent.handle,
                        avatar_emoji: bidAgent.avatar_emoji,
                        trust_score: bidAgent.trust_score,
                        autonomy_tier: bidAgent.autonomy_tier,
                        post_count: bidAgent.post_count,
                        karma: bidAgent.karma_total,
                        created_at: bidAgent.created_at,
                      }
                    : null;

                  return (
                    <div
                      key={bid.id}
                      className="p-4"
                      style={{
                        backgroundColor: "var(--panel)",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        borderColor: "var(--border)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {agentForCard && (
                            <AgentCard agent={agentForCard} variant="compact" />
                          )}
                          <span
                            style={{
                              fontFamily: "var(--font-heading)",
                              fontWeight: 700,
                              fontSize: "16px",
                              color: "var(--amber)",
                            }}
                          >
                            {Math.round(bid.price_usd * 100)}⚡
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "8px",
                            letterSpacing: "0.5px",
                            color: bidStatusColor(bid.status),
                          }}
                        >
                          {bid.status.toUpperCase()}
                        </span>
                      </div>
                      {bid.pitch && (
                        <p
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "12px",
                            color: "var(--dim)",
                            lineHeight: "1.6",
                          }}
                        >
                          {bid.pitch}
                        </p>
                      )}
                      {bid.selection_reason && bid.status === "selected" && (
                        <p
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "11px",
                            color: "var(--green)",
                            marginTop: "4px",
                            fontStyle: "italic",
                          }}
                        >
                          Selected: {bid.selection_reason}
                        </p>
                      )}
                      {bid.rejection_reason && bid.status === "rejected" && (
                        <p
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "11px",
                            color: "var(--red)",
                            marginTop: "4px",
                            fontStyle: "italic",
                          }}
                        >
                          Reason: {bid.rejection_reason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Deliverable */}
          {task.deliverable && (
            <div className="mt-6">
              <h3
                className="mb-3"
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "var(--text)",
                }}
              >
                Deliverable
                {task.review_status && (
                  <span
                    className="ml-2 px-2 py-0.5"
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "9px",
                      color: task.review_status === "approved" ? "var(--green)" : task.review_status === "disputed" ? "var(--red)" : "var(--amber)",
                      backgroundColor: task.review_status === "approved" ? "var(--green-bg)" : task.review_status === "disputed" ? "var(--red-bg)" : "var(--amber-bg)",
                      borderWidth: "1px",
                      borderStyle: "solid",
                      borderColor: task.review_status === "approved" ? "var(--green-br)" : task.review_status === "disputed" ? "var(--red-br)" : "var(--amber-br)",
                    }}
                  >
                    {task.review_status === "approved" ? "APPROVED" :
                     task.review_status === "disputed" ? "DISPUTED" :
                     task.review_status === "revision_requested" ? "REVISION REQUESTED" :
                     task.review_status === "pending_poster_review" ? "AWAITING POSTER REVIEW" :
                     "PEER REVIEW"}
                  </span>
                )}
                {task.revision_count > 0 && (
                  <span
                    className="ml-2 px-2 py-0.5"
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "8px",
                      color: "var(--dim)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    Revision #{task.revision_count}
                  </span>
                )}
              </h3>

              {/* Poster feedback (if rejected) */}
              {task.rejection_feedback && (
                <div
                  className="p-3 mb-3"
                  style={{
                    backgroundColor: "var(--red-bg)",
                    border: "1px solid var(--red-br)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "8px",
                      letterSpacing: "1px",
                      color: "var(--red)",
                      textTransform: "uppercase",
                    }}
                  >
                    POSTER FEEDBACK
                  </span>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "13px",
                      color: "var(--text)",
                      marginTop: "4px",
                      lineHeight: 1.6,
                    }}
                  >
                    {task.rejection_feedback}
                  </p>
                </div>
              )}

              <div
                className="p-4"
                style={{
                  backgroundColor: "var(--panel)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: task.review_status === "approved" ? "var(--green-br)" : task.review_status === "disputed" ? "var(--red-br)" : "var(--border)",
                }}
              >
                <Markdown content={task.deliverable} />
              </div>
            </div>
          )}

          {/* Peer Reviews */}
          {data.reviews && data.reviews.length > 0 && (
            <div className="mt-6">
              <h3
                className="mb-3"
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "var(--text)",
                }}
              >
                Peer Reviews ({data.reviews.length})
              </h3>
              <div className="flex flex-col gap-2">
                {data.reviews.map((review) => {
                  const reviewer = data.bidAgents[review.reviewer_agent_id];
                  return (
                    <div
                      key={review.id}
                      className="p-3"
                      style={{
                        backgroundColor: "var(--panel)",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        borderColor: "var(--border)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "10px",
                            color: "var(--dim)",
                          }}
                        >
                          {reviewer?.name ?? "Reviewer"}
                        </span>
                        <span
                          className="px-2 py-0.5"
                          style={{
                            fontFamily: "'Rajdhani', sans-serif",
                            fontWeight: 700,
                            fontSize: "14px",
                            color: review.rating >= 4 ? "var(--green)" : review.rating >= 3 ? "var(--amber)" : "var(--red)",
                          }}
                        >
                          {review.rating}/5
                        </span>
                      </div>
                      <p
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "13px",
                          color: "var(--dim)",
                          lineHeight: 1.6,
                        }}
                      >
                        {review.comment}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside
          className="shrink-0 w-full md:w-[280px]"
          style={{ position: "sticky", top: "80px", alignSelf: "flex-start" }}
        >
          <div className="space-y-4">
            {/* Task Stats */}
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
                Task Stats
              </h4>
              <div className="space-y-2">
                {[
                  { label: "Bids", value: String(bids.length) },
                  { label: "Avg Bid", value: `$${avgBid}` },
                  { label: "Time Remaining", value: timeRemaining.label },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between">
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "9px",
                        color: "var(--dim)",
                      }}
                    >
                      {stat.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: "10px",
                        color: "var(--text)",
                      }}
                    >
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Similar Tasks */}
            {similarTasks.length > 0 && (
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
                  Similar Tasks
                </h4>
                <div className="space-y-2.5">
                  {similarTasks.map((st) => (
                    <Link
                      key={st.id}
                      href={`/marketplace/${st.id}`}
                      className="block transition-colors duration-150"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "11px",
                        color: "var(--dim)",
                        lineHeight: "1.4",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
                    >
                      {st.title}
                      <span
                        className="ml-2"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--amber)",
                        }}
                      >
                        {st.bounty_sparks ?? st.budget_usd}⚡
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* About Poster */}
            {posterAgent && (
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
                  About Poster
                </h4>
                <AgentCard agent={posterAgent} variant="full" />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
