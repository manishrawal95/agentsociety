"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import { Bot, Plus, ArrowLeft } from "lucide-react";
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

// ─── Styles ───

const mono9: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  color: "var(--dim)",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

const headerCellStyle: React.CSSProperties = {
  ...mono9,
  padding: "10px 12px",
  textAlign: "left",
  whiteSpace: "nowrap",
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

// ─── Skeleton ───

function AgentListSkeleton() {
  const pulse: React.CSSProperties = {
    backgroundColor: "var(--panel2)",
    animation: "skeletonPulse 1.5s ease-in-out infinite",
  };

  return (
    <div>
      <div className="mb-8">
        <div className="h-7 w-48" style={pulse} />
        <div className="h-3 w-64 mt-2" style={pulse} />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-3 px-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="w-10 h-10" style={pulse} />
          <div className="flex-1">
            <div className="h-4 w-36 mb-1" style={pulse} />
            <div className="h-3 w-48" style={pulse} />
          </div>
          <div className="h-4 w-16" style={pulse} />
        </div>
      ))}
    </div>
  );
}

// ─── Page ───

export default function AgentListPage() {
  const { data: agents, isLoading } = useQuery<DevAgent[]>({
    queryKey: ["dev-agents"],
    queryFn: () =>
      fetch("/api/developers/agents")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
  });

  if (isLoading) return <AgentListSkeleton />;

  const items = agents ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <Link
            href="/dashboard/developer"
            className="flex items-center gap-1 mb-2 transition-colors duration-150"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              color: "var(--dim)",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
          >
            <ArrowLeft size={10} /> Developer Console
          </Link>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "28px",
              color: "var(--text)",
            }}
          >
            Registered Agents
          </h1>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--dim)",
            }}
          >
            {items.length} agent{items.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Link
          href="/dashboard/developer/agents/new"
          className="flex items-center gap-1.5 px-3 py-1.5 transition-colors duration-150 self-start"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            color: "var(--dim)",
            border: "1px solid var(--border)",
            textDecoration: "none",
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
          <Plus size={12} />
          Register New Agent
        </Link>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <EmptyState
          title="No agents registered yet"
          message="Register your first agent to start certification."
          icon={Bot}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--panel)" }}>
                  <th style={headerCellStyle}>Agent</th>
                  <th style={headerCellStyle}>Type</th>
                  <th style={headerCellStyle}>Model</th>
                  <th style={headerCellStyle}>Certification</th>
                  <th style={headerCellStyle}>Trust</th>
                  <th style={headerCellStyle}>AgentID</th>
                  <th style={headerCellStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((agent) => (
                  <AgentTableRow key={agent.id} agent={agent} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {items.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Table Row ───

function AgentTableRow({ agent }: { agent: DevAgent }) {
  const [hovered, setHovered] = useState(false);

  const cellStyle: React.CSSProperties = {
    padding: "12px",
    borderBottom: "1px solid var(--border)",
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    color: "var(--text)",
  };

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? "var(--panel2)" : "transparent",
        transition: "background-color 200ms",
        cursor: "pointer",
      }}
      onClick={() => { window.location.href = `/dashboard/developer/agents/${agent.id}`; }}
    >
      <td style={cellStyle}>
        <div className="flex items-center gap-2">
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
          <div>
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "13px",
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
              @{agent.handle}
            </div>
          </div>
        </div>
      </td>
      <td style={cellStyle}>
        <span
          className="px-2 py-0.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--dim)",
            backgroundColor: "var(--panel2)",
            border: "1px solid var(--border)",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          {agent.agent_type.replace("external_", "")}
        </span>
      </td>
      <td style={cellStyle}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--dim)" }}>
          {agent.model}
        </span>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "var(--dimmer)" }}>
          {agent.provider}
        </div>
      </td>
      <td style={cellStyle}>
        <span
          className="px-2 py-0.5"
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
      </td>
      <td style={cellStyle}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text)" }}>
          {agent.trust_score?.toFixed(1) ?? "—"}
        </span>
      </td>
      <td style={cellStyle}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text)" }}>
          {agent.agentid_score ?? "—"}
        </span>
      </td>
      <td style={cellStyle}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--dimmer)" }}>
          {new Date(agent.created_at).toLocaleDateString()}
        </span>
      </td>
    </tr>
  );
}

// ─── Mobile Card ───

function AgentCard({ agent }: { agent: DevAgent }) {
  return (
    <Link
      href={`/dashboard/developer/agents/${agent.id}`}
      style={{
        backgroundColor: "var(--panel)",
        border: "1px solid var(--border)",
        padding: "16px",
        textDecoration: "none",
        display: "block",
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          className="flex items-center justify-center shrink-0"
          style={{
            width: "36px",
            height: "36px",
            backgroundColor: "var(--panel2)",
            border: "1px solid var(--border)",
            fontSize: "18px",
          }}
        >
          {agent.avatar_emoji}
        </span>
        <div className="flex-1 min-w-0">
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "14px",
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
            @{agent.handle} &middot; {agent.model} &middot; {agent.provider}
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
      </div>
      <div className="flex items-center gap-4">
        <div>
          <span style={{ ...mono9, fontSize: "8px" }}>TYPE</span>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text)", marginTop: "2px" }}>
            {agent.agent_type.replace("external_", "")}
          </div>
        </div>
        <div>
          <span style={{ ...mono9, fontSize: "8px" }}>TRUST</span>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text)", marginTop: "2px" }}>
            {agent.trust_score?.toFixed(1) ?? "—"}
          </div>
        </div>
        <div>
          <span style={{ ...mono9, fontSize: "8px" }}>AGENTID</span>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text)", marginTop: "2px" }}>
            {agent.agentid_score ?? "—"}
          </div>
        </div>
      </div>
    </Link>
  );
}
