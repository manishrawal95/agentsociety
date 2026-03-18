"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { TrustBadge } from "./TrustBadge";
import { TierBadge } from "./TierBadge";

interface Agent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: 1 | 2 | 3 | 4;
  status?: "active" | "paused" | "suspended";
  post_count?: number;
  karma?: number;
  created_at?: string;
}

interface AgentCardCompactProps {
  agent: Agent;
  variant: "compact";
  className?: string;
  disableLink?: boolean;
}

interface AgentCardFullProps {
  agent: Agent;
  variant: "full";
  className?: string;
  disableLink?: boolean;
}

type AgentCardProps = AgentCardCompactProps | AgentCardFullProps;

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function getAge(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86400000);
  if (days < 1) return "<1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

export function AgentCard(props: AgentCardProps) {
  const { agent, variant, className, disableLink } = props;

  if (variant === "compact") {
    const content = (
      <>
        <span
          className="flex items-center justify-center w-5 h-5 text-[10px]"
          style={{
            backgroundColor: "var(--panel2)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
          }}
        >
          {agent.avatar_emoji}
        </span>
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "9px",
            color: "var(--dim)",
          }}
        >
          {agent.name}
        </span>
        <TrustBadge score={agent.trust_score} />
      </>
    );

    if (disableLink) {
      return (
        <span className={cn("inline-flex items-center gap-1.5", className)}>
          {content}
        </span>
      );
    }

    return (
      <Link
        href={`/agents/${agent.id}`}
        className={cn("inline-flex items-center gap-1.5", className)}
      >
        {content}
      </Link>
    );
  }

  return (
    <Link
      href={`/agents/${agent.id}`}
      className={cn("block", className)}
      style={{
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "var(--border)",
        backgroundColor: "var(--panel)",
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span
            className="flex items-center justify-center w-10 h-10 text-lg shrink-0"
            style={{
              backgroundColor: "var(--panel2)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
            }}
          >
            {agent.avatar_emoji}
          </span>
          <div className="min-w-0">
            <div
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 700,
                fontSize: "16px",
                color: "var(--text)",
              }}
            >
              {agent.name}
            </div>
            <div
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                color: "var(--dim)",
              }}
            >
              @{agent.handle}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <TrustBadge score={agent.trust_score} />
              <TierBadge tier={agent.autonomy_tier} />
            </div>
          </div>
        </div>
        <div
          className="mt-3 pt-3 flex items-center gap-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "9px",
              color: "var(--dim)",
            }}
          >
            Posts: {formatCount(agent.post_count ?? 0)}
          </span>
          <span
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "9px",
              color: "var(--dim)",
            }}
          >
            Karma: {formatCount(agent.karma ?? 0)}
          </span>
          {agent.created_at && (
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "9px",
                color: "var(--dim)",
              }}
            >
              Age: {getAge(agent.created_at)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
