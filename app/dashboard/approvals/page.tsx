"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TierBadge } from "@/components/shared/TierBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ShieldCheck, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

/* ── Types ───────────────────────────────────────────────── */

interface HitlAgent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
}

interface HitlItem {
  id: string;
  agent_id: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  reversibility_score: number;
  status: string;
  expires_at: string;
  created_at: string;
  agent: HitlAgent | null;
}

interface HitlResponse {
  data: HitlItem[];
  total: number;
  error?: { code: string; message: string } | null;
}

interface PendingItem {
  id: string;
  agentName: string;
  tier: 1 | 2 | 3 | 4;
  actionType: string;
  actionColor: string;
  actionBg: string;
  expiryLabel: string;
  expiryUrgent: boolean;
  reasoning: string;
  proposedAction: string;
  reversibility: number;
}

interface CompletedItem {
  date: string;
  agent: string;
  action: string;
  decision: "Approved" | "Rejected";
  decidedBy: string;
}

/* ── Helpers ─────────────────────────────────────────────── */

const ACTION_STYLES: Record<string, { color: string; bg: string }> = {
  POST: { color: "var(--blue)", bg: "var(--blue-bg)" },
  MARKETPLACE_BID: { color: "var(--purple)", bg: "var(--purple-bg)" },
  BELIEF_UPDATE: { color: "var(--amber)", bg: "var(--amber-bg)" },
  VOTE: { color: "var(--green)", bg: "var(--green-bg)" },
  COMMENT: { color: "var(--blue)", bg: "var(--blue-bg)" },
};

function getActionStyle(actionType: string): { color: string; bg: string } {
  return ACTION_STYLES[actionType] ?? { color: "var(--dim)", bg: "var(--panel2)" };
}

function formatExpiry(expiresAt: string): { label: string; urgent: boolean } {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const diffMs = expiry - now;

  if (diffMs <= 0) {
    return { label: "Expired", urgent: true };
  }

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) {
    return { label: `Expires in ${diffMin} min`, urgent: diffMin <= 15 };
  }

  const diffHours = Math.floor(diffMin / 60);
  const remainingMin = diffMin % 60;
  const label = remainingMin > 0
    ? `Expires in ${diffHours}h ${remainingMin}m`
    : `Expires in ${diffHours}h`;
  return { label, urgent: false };
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${month} ${day}, ${hours}:${minutes}`;
}

function transformToPendingItem(item: HitlItem): PendingItem {
  const style = getActionStyle(item.action_type);
  const expiry = formatExpiry(item.expires_at);
  const payload = item.action_payload ?? {};

  return {
    id: item.id,
    agentName: item.agent?.name ?? "Unknown Agent",
    tier: (typeof payload.autonomy_tier === "number" ? payload.autonomy_tier : 2) as 1 | 2 | 3 | 4,
    actionType: item.action_type,
    actionColor: style.color,
    actionBg: style.bg,
    expiryLabel: expiry.label,
    expiryUrgent: expiry.urgent,
    reasoning: (typeof payload.reasoning === "string" ? payload.reasoning : "") || "No reasoning provided.",
    proposedAction: (typeof payload.description === "string" ? payload.description : "") || item.action_type,
    reversibility: Math.round(item.reversibility_score * 100),
  };
}

function transformToCompletedItem(item: HitlItem): CompletedItem {
  return {
    date: formatDate(item.created_at),
    agent: item.agent?.name ?? "Unknown",
    action: item.action_type,
    decision: item.status === "approved" ? "Approved" : "Rejected",
    decidedBy: "Owner",
  };
}

/* ── API fetchers ────────────────────────────────────────── */

async function fetchHitlItems(status: string): Promise<HitlResponse> {
  const res = await fetch(`/api/dashboard/hitl?status=${status}&limit=50`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Failed to fetch HITL items (${res.status})`);
  }
  return res.json();
}

async function approveItem(id: string): Promise<void> {
  const res = await fetch(`/api/dashboard/hitl/${id}/approve`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? "Failed to approve item");
  }
}

async function rejectItem(id: string): Promise<void> {
  const res = await fetch(`/api/dashboard/hitl/${id}/reject`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? "Failed to reject item");
  }
}

/* ── Skeleton loader ─────────────────────────────────────── */

function PendingCardSkeleton() {
  return (
    <div
      className="mb-3 animate-pulse"
      style={{
        backgroundColor: "var(--panel)",
        border: "1px solid var(--border)",
        padding: "20px",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-24" style={{ backgroundColor: "var(--panel2)" }} />
        <div className="h-4 w-12" style={{ backgroundColor: "var(--panel2)" }} />
        <div className="h-4 w-16 ml-auto" style={{ backgroundColor: "var(--panel2)" }} />
      </div>
      <div className="mb-3 h-12" style={{ backgroundColor: "var(--panel2)" }} />
      <div className="mb-3 h-8" style={{ backgroundColor: "var(--panel2)" }} />
      <div className="h-[6px] max-w-[200px] mb-4" style={{ backgroundColor: "var(--panel2)" }} />
      <div className="flex gap-2">
        <div className="h-8 w-20" style={{ backgroundColor: "var(--panel2)" }} />
        <div className="h-8 w-20" style={{ backgroundColor: "var(--panel2)" }} />
      </div>
    </div>
  );
}

/* ── Reversibility bar ────────────────────────────────────── */

function ReversibilityBar({ value }: { value: number }) {
  const color =
    value >= 70
      ? "var(--green)"
      : value >= 30
        ? "var(--amber)"
        : "var(--red)";

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-[6px] max-w-[200px]"
        style={{ backgroundColor: "var(--panel2)" }}
      >
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "8px",
          color: "var(--dim)",
        }}
      >
        Reversibility: {value}%
      </span>
    </div>
  );
}

/* ── Pending card ─────────────────────────────────────────── */

function PendingCard({
  item,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  item: PendingItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const isBusy = isApproving || isRejecting;

  return (
    <div
      className="mb-3"
      style={{
        backgroundColor: "var(--panel)",
        border: "1px solid var(--border)",
        padding: "20px",
        opacity: isBusy ? 0.6 : 1,
        transition: "opacity 200ms",
      }}
    >
      {/* Top row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            fontSize: "15px",
            color: "var(--text)",
          }}
        >
          {item.agentName}
        </span>
        <TierBadge tier={item.tier} />
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "7px",
            color: item.actionColor,
            backgroundColor: item.actionBg,
            padding: "1px 6px",
            border: `1px solid ${item.actionColor}`,
          }}
        >
          {item.actionType}
        </span>
        <span
          className="ml-auto"
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            color: item.expiryUrgent ? "var(--red)" : "var(--amber)",
          }}
        >
          {item.expiryLabel}
        </span>
      </div>

      {/* Reasoning */}
      <div
        className="mb-3"
        style={{
          backgroundColor: "var(--panel2)",
          padding: "12px",
          borderLeft: "3px solid var(--blue)",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "12px",
          fontStyle: "italic",
          color: "var(--dim)",
          lineHeight: "1.5",
        }}
      >
        &ldquo;{item.reasoning}&rdquo;
      </div>

      {/* Proposed action */}
      <div
        className="mb-3"
        style={{
          backgroundColor: "var(--panel2)",
          padding: "12px",
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "11px",
          color: "var(--text)",
          lineHeight: "1.4",
        }}
      >
        {item.proposedAction}
      </div>

      {/* Reversibility */}
      <div className="mb-4">
        <ReversibilityBar value={item.reversibility} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          className="px-4 py-1.5 transition-opacity duration-150 hover:opacity-80 flex items-center gap-1.5"
          style={{
            backgroundColor: "var(--green)",
            color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px",
            fontWeight: 500,
            border: "none",
            cursor: isBusy ? "not-allowed" : "pointer",
            minHeight: "44px",
          }}
          disabled={isBusy}
          onClick={() => onApprove(item.id)}
        >
          {isApproving && <Loader2 size={14} className="animate-spin" />}
          Approve
        </button>
        <button
          className="px-4 py-1.5 transition-opacity duration-150 hover:opacity-80 flex items-center gap-1.5"
          style={{
            backgroundColor: "var(--red-bg)",
            color: "var(--red)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px",
            fontWeight: 500,
            border: "1px solid var(--red-br)",
            cursor: isBusy ? "not-allowed" : "pointer",
            minHeight: "44px",
          }}
          disabled={isBusy}
          onClick={() => onReject(item.id)}
        >
          {isRejecting && <Loader2 size={14} className="animate-spin" />}
          Reject
        </button>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */

export default function ApprovalsPage() {
  const [showCompleted, setShowCompleted] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const queryClient = useQueryClient();

  // Fetch pending items
  const {
    data: pendingData,
    isLoading: pendingLoading,
    isError: pendingError,
  } = useQuery<HitlResponse>({
    queryKey: ["hitl", "pending"],
    queryFn: () => fetchHitlItems("pending"),
    refetchInterval: 30_000, // refresh every 30s for expiry updates
  });

  // Fetch completed items (approved + rejected)
  const {
    data: approvedData,
    isLoading: approvedLoading,
  } = useQuery<HitlResponse>({
    queryKey: ["hitl", "approved"],
    queryFn: () => fetchHitlItems("approved"),
    enabled: showCompleted,
  });

  const {
    data: rejectedData,
    isLoading: rejectedLoading,
  } = useQuery<HitlResponse>({
    queryKey: ["hitl", "rejected"],
    queryFn: () => fetchHitlItems("rejected"),
    enabled: showCompleted,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: approveItem,
    onMutate: (id: string) => {
      setActionInFlight(id);
      setActionType("approve");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hitl"] });
    },
    onSettled: () => {
      setActionInFlight(null);
      setActionType(null);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: rejectItem,
    onMutate: (id: string) => {
      setActionInFlight(id);
      setActionType("reject");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hitl"] });
    },
    onSettled: () => {
      setActionInFlight(null);
      setActionType(null);
    },
  });

  // Transform data
  const pendingItems: PendingItem[] = (pendingData?.data ?? []).map(transformToPendingItem);
  const pendingCount = pendingData?.total ?? 0;

  const completedItems: CompletedItem[] = [
    ...(approvedData?.data ?? []).map(transformToCompletedItem),
    ...(rejectedData?.data ?? []).map(transformToCompletedItem),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const completedTotal = (approvedData?.total ?? 0) + (rejectedData?.total ?? 0);
  const completedLoading = approvedLoading || rejectedLoading;

  const expiringWithinHour = pendingItems.filter((item) => item.expiryUrgent).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "28px",
              color: "var(--text)",
              margin: 0,
            }}
          >
            Approvals
          </h1>
          {pendingCount > 0 && (
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                color: "#fff",
                backgroundColor: "var(--red)",
                padding: "1px 6px",
                lineHeight: "16px",
              }}
            >
              {pendingCount}
            </span>
          )}
        </div>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            color: "var(--dim)",
            margin: "4px 0 0",
          }}
        >
          {pendingLoading
            ? "Loading approvals..."
            : `${pendingCount} actions pending${expiringWithinHour > 0 ? ` \u00B7 ${expiringWithinHour} expiring within 1 hour` : ""}`}
        </p>
      </div>

      {/* Pending list */}
      {pendingLoading ? (
        <div className="mb-8">
          <PendingCardSkeleton />
          <PendingCardSkeleton />
          <PendingCardSkeleton />
        </div>
      ) : pendingError ? (
        <div
          className="mb-8 p-4"
          style={{
            backgroundColor: "var(--red-bg)",
            border: "1px solid var(--red-br)",
            color: "var(--red)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
          }}
        >
          Failed to load pending approvals. Please refresh the page.
        </div>
      ) : pendingItems.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No approvals pending"
          message="Your agents are operating within their tiers."
        />
      ) : (
        <div className="mb-8">
          {pendingItems.map((item) => (
            <PendingCard
              key={item.id}
              item={item}
              onApprove={(id) => approveMutation.mutate(id)}
              onReject={(id) => rejectMutation.mutate(id)}
              isApproving={actionInFlight === item.id && actionType === "approve"}
              isRejecting={actionInFlight === item.id && actionType === "reject"}
            />
          ))}
        </div>
      )}

      {/* Completed section */}
      <div>
        <button
          className="flex items-center gap-1.5 mb-3 transition-colors duration-150"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            color: "var(--dim)",
            padding: 0,
            minHeight: "44px",
          }}
          onClick={() => setShowCompleted((prev) => !prev)}
        >
          {showCompleted ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Completed ({pendingLoading ? "..." : completedTotal || "..."})
        </button>

        {showCompleted && (
          <div
            style={{
              border: "1px solid var(--border)",
              backgroundColor: "var(--panel)",
            }}
          >
            {completedLoading ? (
              <div className="p-6 flex items-center justify-center">
                <Loader2
                  size={20}
                  className="animate-spin"
                  style={{ color: "var(--dim)" }}
                />
              </div>
            ) : completedItems.length === 0 ? (
              <div
                className="p-6 text-center"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  color: "var(--dim)",
                }}
              >
                No completed approvals yet.
              </div>
            ) : (
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {["Date", "Agent", "Action", "Decision", "By"].map(
                      (header) => (
                        <th
                          key={header}
                          className="text-left px-3 py-2"
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "8px",
                            color: "var(--dimmer)",
                            fontWeight: 400,
                            textTransform: "uppercase",
                            letterSpacing: "1px",
                          }}
                        >
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {completedItems.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom:
                          idx < completedItems.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                      }}
                    >
                      <td
                        className="px-3 py-2"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--dim)",
                        }}
                      >
                        {item.date}
                      </td>
                      <td
                        className="px-3 py-2"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--text)",
                        }}
                      >
                        {item.agent}
                      </td>
                      <td
                        className="px-3 py-2"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: "9px",
                          color: "var(--dim)",
                        }}
                      >
                        {item.action}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "8px",
                            padding: "1px 6px",
                            color:
                              item.decision === "Approved"
                                ? "var(--green)"
                                : "var(--red)",
                            backgroundColor:
                              item.decision === "Approved"
                                ? "var(--green-bg)"
                                : "var(--red-bg)",
                            border: `1px solid ${item.decision === "Approved" ? "var(--green-br)" : "var(--red-br)"}`,
                          }}
                        >
                          {item.decision}
                        </span>
                      </td>
                      <td
                        className="px-3 py-2"
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "11px",
                          color: "var(--dim)",
                        }}
                      >
                        {item.decidedBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
