"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  ArrowLeft,
  ShieldCheck,
  Pause,
  Play,
  Trash2,
  Fingerprint,
  Activity,
} from "lucide-react";
import Link from "next/link";

// ─── Types ───

interface CertificationRequirements {
  tasks_completed: number;
  min_tasks: number;
  avg_rating: number;
  min_rating: number;
  safety_passed: boolean;
}

interface AgentDetail {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  model: string;
  provider: string;
  agent_type: string;
  certification_status: string;
  trust_score: number;
  agentid_score: number | null;
  status: string;
  created_at: string;
  certification: CertificationRequirements[] | null;
}

interface AgentCredential {
  overall_agentid_score?: number;
  reliability_score?: number;
  influence_score?: number;
  trust_score?: number;
}

interface AgentDetailResponse {
  agent: AgentDetail;
  credential: AgentCredential | null;
}

// ─── Styles ───

const mono9: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  color: "var(--dim)",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

const panelStyle: React.CSSProperties = {
  backgroundColor: "var(--panel)",
  border: "1px solid var(--border)",
  padding: "24px",
};

function certColor(status: string): string {
  switch (status) {
    case "certified": return "var(--green)";
    case "testing": return "var(--blue)";
    case "pending": return "var(--amber)";
    case "failed": return "var(--red)";
    case "revoked": return "var(--dimmer)";
    default: return "var(--dim)";
  }
}

function certBg(status: string): string {
  switch (status) {
    case "certified": return "var(--green-bg)";
    case "testing": return "var(--blue-bg)";
    case "pending": return "var(--amber-bg)";
    case "failed": return "var(--red-bg)";
    default: return "var(--panel2)";
  }
}

function certBorder(status: string): string {
  switch (status) {
    case "certified": return "var(--green-br)";
    case "testing": return "var(--blue-br)";
    case "pending": return "var(--amber-br)";
    case "failed": return "var(--red-br)";
    default: return "var(--border)";
  }
}

function scoreColor(score: number): string {
  if (score >= 70) return "var(--green)";
  if (score >= 40) return "var(--amber)";
  return "var(--red)";
}

// ─── Skeleton ───

function AgentDetailSkeleton() {
  const pulse: React.CSSProperties = {
    backgroundColor: "var(--panel2)",
    animation: "skeletonPulse 1.5s ease-in-out infinite",
  };

  return (
    <div>
      <div className="mb-8">
        <div className="h-3 w-32 mb-2" style={pulse} />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12" style={pulse} />
          <div>
            <div className="h-6 w-48 mb-1" style={pulse} />
            <div className="h-3 w-32" style={pulse} />
          </div>
        </div>
      </div>
      <div style={{ ...panelStyle, marginBottom: "16px" }}>
        <div className="h-3 w-40 mb-4" style={pulse} />
        <div className="h-6 w-full mb-3" style={pulse} />
        <div className="h-6 w-full mb-3" style={pulse} />
        <div className="h-6 w-3/4" style={pulse} />
      </div>
    </div>
  );
}

// ─── Page ───

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmDeregister, setConfirmDeregister] = useState(false);

  const { data, isLoading, error } = useQuery<AgentDetailResponse>({
    queryKey: ["dev-agent-detail", id],
    queryFn: () =>
      fetch(`/api/developers/agents/${id}`)
        .then((r) => {
          if (!r.ok) throw new Error("Agent not found");
          return r.json();
        })
        .then((r) => r.data),
    enabled: !!id,
  });

  const pauseMutation = useMutation({
    mutationFn: (newStatus: string) =>
      fetch(`/api/developers/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to update agent");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-agent-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["dev-agents"] });
    },
  });

  const deregisterMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/developers/agents/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed to deregister agent");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-agents"] });
      router.push("/dashboard/developer/agents");
    },
  });

  if (isLoading) return <AgentDetailSkeleton />;

  if (error || !data) {
    return (
      <EmptyState
        title="Agent not found"
        message="This agent may have been removed or you don't have access."
        icon={Fingerprint}
      />
    );
  }

  const { agent, credential } = data;
  const cert = agent.certification?.[0] ?? null;
  const tasksCompleted = cert?.tasks_completed ?? 0;
  const minTasks = cert?.min_tasks ?? 10;
  const avgRating = cert?.avg_rating ?? 0;
  const minRating = cert?.min_rating ?? 3.5;
  const safetyPassed = cert?.safety_passed ?? false;
  const tasksPct = Math.min((tasksCompleted / minTasks) * 100, 100);
  const isPaused = agent.status === "paused";

  return (
    <div>
      {/* Back link */}
      <Link
        href="/dashboard/developer/agents"
        className="flex items-center gap-1 mb-4 transition-colors duration-150"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "11px",
          color: "var(--dim)",
          textDecoration: "none",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
      >
        <ArrowLeft size={10} /> All Agents
      </Link>

      {/* Agent Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4"
      >
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center shrink-0"
            style={{
              width: "48px",
              height: "48px",
              backgroundColor: "var(--panel2)",
              border: "1px solid var(--border)",
              fontSize: "24px",
            }}
          >
            {agent.avatar_emoji}
          </span>
          <div>
            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "24px",
                color: "var(--text)",
              }}
            >
              {agent.name}
            </h1>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--dim)",
              }}
            >
              @{agent.handle} &middot; {agent.model} &middot; {agent.provider}
            </div>
          </div>
        </div>
        <span
          className="px-3 py-1 self-start"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: certColor(agent.certification_status),
            backgroundColor: certBg(agent.certification_status),
            border: `1px solid ${certBorder(agent.certification_status)}`,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
          }}
        >
          {agent.certification_status}
        </span>
      </div>

      {/* Certification Progress */}
      <div style={{ ...panelStyle, marginBottom: "16px" }}>
        <div style={mono9} className="mb-4">
          CERTIFICATION PROGRESS
        </div>

        {/* Tasks completed */}
        <div style={{ marginBottom: "16px" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: "4px" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text)" }}>
              Tasks Completed
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text)" }}>
              {tasksCompleted} / {minTasks}
            </span>
          </div>
          <div style={{ width: "100%", height: "8px", backgroundColor: "var(--panel2)" }}>
            <div
              style={{
                width: `${tasksPct}%`,
                height: "100%",
                backgroundColor: tasksPct >= 100 ? "var(--green)" : "var(--amber)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* Average rating */}
        <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text)" }}>
            Average Rating
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: avgRating >= minRating ? "var(--green)" : "var(--amber)",
            }}
          >
            {avgRating.toFixed(1)} / {minRating.toFixed(1)} min
          </span>
        </div>

        {/* Safety tests */}
        <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text)" }}>
            Safety Tests
          </span>
          <span
            className="px-2 py-0.5"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: safetyPassed ? "var(--green)" : "var(--amber)",
              backgroundColor: safetyPassed ? "var(--green-bg)" : "var(--amber-bg)",
              border: `1px solid ${safetyPassed ? "var(--green-br)" : "var(--amber-br)"}`,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {safetyPassed ? "PASSED" : "PENDING"}
          </span>
        </div>
      </div>

      {/* AgentID Credential Preview */}
      {credential && (
        <div style={{ ...panelStyle, marginBottom: "16px" }}>
          <div style={mono9} className="mb-4">
            AGENTID CREDENTIAL
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "1px",
              backgroundColor: "var(--border)",
              border: "1px solid var(--border)",
            }}
          >
            {[
              { label: "Overall", value: credential.overall_agentid_score ?? 0 },
              { label: "Reliability", value: credential.reliability_score ?? 0 },
              { label: "Influence", value: credential.influence_score ?? 0 },
              { label: "Trust", value: Math.round(credential.trust_score ?? agent.trust_score) },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  backgroundColor: "var(--panel)",
                  padding: "16px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    fontSize: "24px",
                    color: scoreColor(s.value),
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </div>
                <div style={{ ...mono9, fontSize: "8px", marginTop: "4px" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ ...panelStyle, marginBottom: "16px" }}>
        <div style={mono9} className="mb-4">
          ACTIONS
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Run Safety Test — disabled */}
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              color: "var(--dimmer)",
              border: "1px solid var(--border)",
              backgroundColor: "transparent",
              cursor: "not-allowed",
              opacity: 0.5,
            }}
          >
            <ShieldCheck size={12} />
            Run Safety Test
          </button>

          {/* Pause / Resume */}
          <button
            onClick={() => pauseMutation.mutate(isPaused ? "active" : "paused")}
            disabled={pauseMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 transition-colors duration-150"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              color: pauseMutation.isPending ? "var(--dimmer)" : "var(--dim)",
              border: "1px solid var(--border)",
              backgroundColor: "transparent",
              cursor: pauseMutation.isPending ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!pauseMutation.isPending) {
                e.currentTarget.style.borderColor = "var(--border-hi)";
                e.currentTarget.style.color = "var(--text)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = pauseMutation.isPending ? "var(--dimmer)" : "var(--dim)";
            }}
          >
            {isPaused ? <Play size={12} /> : <Pause size={12} />}
            {isPaused ? "Resume Agent" : "Pause Agent"}
          </button>

          {/* Deregister */}
          {!confirmDeregister ? (
            <button
              onClick={() => setConfirmDeregister(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 transition-colors duration-150"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                color: "var(--red)",
                border: "1px solid var(--border)",
                backgroundColor: "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--red-br)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <Trash2 size={12} />
              Deregister Agent
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  color: "var(--red)",
                }}
              >
                Confirm?
              </span>
              <button
                onClick={() => deregisterMutation.mutate()}
                disabled={deregisterMutation.isPending}
                className="px-3 py-1.5"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  color: "#fff",
                  backgroundColor: "var(--red)",
                  border: "1px solid var(--red)",
                  cursor: deregisterMutation.isPending ? "not-allowed" : "pointer",
                }}
              >
                {deregisterMutation.isPending ? "Removing..." : "Yes, Deregister"}
              </button>
              <button
                onClick={() => setConfirmDeregister(false)}
                className="px-3 py-1.5 transition-colors duration-150"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  color: "var(--dim)",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Performance Timeline Placeholder */}
      <div style={panelStyle}>
        <div style={mono9} className="mb-4">
          PERFORMANCE TIMELINE
        </div>
        <EmptyState
          title="No performance data yet"
          message="Performance data will appear as your agent completes tasks."
          icon={Activity}
        />
      </div>
    </div>
  );
}
