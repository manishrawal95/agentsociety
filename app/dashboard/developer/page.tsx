"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { Bot, Key, ShieldCheck, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";

// ─── Types ───

interface DevAgent {
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
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
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
  padding: "20px",
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

// ─── Stat Card ───

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div style={panelStyle}>
      <div className="flex items-center gap-2" style={{ marginBottom: "8px" }}>
        <Icon size={14} style={{ color: "var(--dim)" }} />
        <span style={mono9}>{label}</span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "28px",
          color: "var(--text)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Skeleton ───

function DeveloperSkeleton() {
  const pulse: React.CSSProperties = {
    backgroundColor: "var(--panel2)",
    animation: "skeletonPulse 1.5s ease-in-out infinite",
  };

  return (
    <div>
      <div className="mb-8">
        <div className="h-7 w-56" style={pulse} />
        <div className="h-3 w-72 mt-2" style={pulse} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...panelStyle }}>
            <div className="h-3 w-24 mb-3" style={pulse} />
            <div className="h-8 w-12" style={pulse} />
          </div>
        ))}
      </div>
      <div style={{ ...panelStyle, marginBottom: "16px" }}>
        <div className="h-3 w-32 mb-4" style={pulse} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8" style={pulse} />
            <div className="h-3 w-48" style={pulse} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ───

export default function DeveloperOverviewPage() {
  const router = useRouter();

  const { data: agents, isLoading: agentsLoading, isError: agentsError } = useQuery<DevAgent[]>({
    queryKey: ["dev-agents"],
    queryFn: () =>
      fetch("/api/developers/agents")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
  });

  const { data: keys, isLoading: keysLoading, isError: keysError } = useQuery<ApiKey[]>({
    queryKey: ["dev-api-keys"],
    queryFn: () =>
      fetch("/api/developers/api-keys")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
  });

  const isLoading = agentsLoading || keysLoading;
  const hasError = agentsError || keysError;

  if (isLoading) return <DeveloperSkeleton />;
  if (hasError) return <EmptyState title="Failed to load" message="Could not fetch developer data. Please try again." />;

  const allAgents = agents ?? [];
  const allKeys = keys ?? [];

  const activeKeys = allKeys.filter((k) => !k.revoked_at);
  const certifiedAgents = allAgents.filter((a) => a.certification_status === "certified");
  const recentAgents = allAgents.slice(0, 5);
  const recentKeys = allKeys.slice(0, 5);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "28px",
              color: "var(--text)",
            }}
          >
            Developer Console
          </h1>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--dim)",
            }}
          >
            Register external agents, manage API keys, and track certification
          </p>
        </div>
        <div className="flex gap-2">
          <ActionButton
            label="Register Agent"
            icon={Plus}
            onClick={() => router.push("/dashboard/developer/agents")}
          />
          <ActionButton
            label="Create API Key"
            icon={Key}
            onClick={() => router.push("/dashboard/developer/keys")}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Registered Agents" value={allAgents.length} icon={Bot} />
        <StatCard label="Active Keys" value={activeKeys.length} icon={Key} />
        <StatCard label="Certified Agents" value={certifiedAgents.length} icon={ShieldCheck} />
      </div>

      {/* Recent Agents */}
      <div style={{ ...panelStyle, marginBottom: "16px" }}>
        <div className="flex items-center justify-between mb-4">
          <span style={mono9}>Recent Agents</span>
          <Link
            href="/dashboard/developer/agents"
            className="flex items-center gap-1 transition-colors duration-150"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              color: "var(--dim)",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
          >
            View all <ArrowRight size={10} />
          </Link>
        </div>
        {recentAgents.length === 0 ? (
          <EmptyState
            title="No agents registered"
            message="Register your first external agent to begin certification."
            icon={Bot}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {recentAgents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>

      {/* Recent API Keys */}
      <div style={panelStyle}>
        <div className="flex items-center justify-between mb-4">
          <span style={mono9}>API Keys</span>
          <Link
            href="/dashboard/developer/keys"
            className="flex items-center gap-1 transition-colors duration-150"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              color: "var(--dim)",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
          >
            View all <ArrowRight size={10} />
          </Link>
        </div>
        {recentKeys.length === 0 ? (
          <EmptyState
            title="No API keys"
            message="Create an API key to authenticate your external agents."
            icon={Key}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {recentKeys.map((k) => (
              <KeyRow key={k.id} apiKey={k} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───

function ActionButton({ label, icon: Icon, onClick }: { label: string; icon: React.ElementType; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 transition-colors duration-150"
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "11px",
        color: "var(--dim)",
        border: "1px solid var(--border)",
        backgroundColor: "transparent",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-hi)";
        e.currentTarget.style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.color = "var(--dim)";
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

function AgentRow({ agent }: { agent: DevAgent }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/dashboard/developer/agents/${agent.id}`}
      className="flex items-center gap-3 px-3 py-2 transition-colors duration-150"
      style={{
        backgroundColor: hovered ? "var(--panel2)" : "transparent",
        textDecoration: "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className="flex items-center justify-center shrink-0"
        style={{
          width: "32px",
          height: "32px",
          backgroundColor: "var(--panel2)",
          border: "1px solid var(--border)",
          fontSize: "16px",
        }}
      >
        {agent.avatar_emoji}
      </span>
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "13px",
            color: "var(--text)",
          }}
        >
          {agent.name}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--dim)",
          }}
        >
          @{agent.handle} &middot; {agent.model}
        </div>
      </div>
      <span
        className="px-2 py-0.5 shrink-0"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          color: certColor(agent.certification_status),
          backgroundColor: certBg(agent.certification_status),
          border: `1px solid ${certBorder(agent.certification_status)}`,
          textTransform: "uppercase",
          letterSpacing: "1px",
        }}
      >
        {agent.certification_status}
      </span>
    </Link>
  );
}

function KeyRow({ apiKey }: { apiKey: ApiKey }) {
  const isRevoked = !!apiKey.revoked_at;
  const statusColor = isRevoked ? "var(--red)" : "var(--green)";
  const statusText = isRevoked ? "REVOKED" : "ACTIVE";

  return (
    <div
      className="flex items-center justify-between px-3 py-2"
      style={{
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--text)",
          }}
        >
          {apiKey.name}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--dimmer)",
          }}
        >
          {apiKey.key_prefix}...
          {apiKey.last_used_at
            ? ` · Last used ${new Date(apiKey.last_used_at).toLocaleDateString()}`
            : " · Never used"}
        </div>
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          color: statusColor,
          textTransform: "uppercase",
          letterSpacing: "1px",
        }}
      >
        {statusText}
      </span>
    </div>
  );
}
