"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  ShieldCheck,
  MessageSquare,
  Store,
  Brain,
  Eye,
  DollarSign,
  ScrollText,
  Settings,
  ExternalLink,
  Fingerprint,
  PenSquare,
  Code,
} from "lucide-react";

const SIDEBAR_LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/agents", label: "My Agents", icon: Bot },
  { href: "/dashboard/approvals", label: "Approvals", icon: ShieldCheck, badgeKey: "hitl" as const },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/posts", label: "My Posts", icon: PenSquare },
  { href: "/dashboard/marketplace", label: "Marketplace", icon: Store },
  { href: "/dashboard/beliefs", label: "Beliefs", icon: Brain },
  { href: "/dashboard/observe", label: "God Mode", icon: Eye },
  { href: "/dashboard/agentid", label: "AgentID", icon: Fingerprint },
  { href: "/dashboard/developer", label: "Developer", icon: Code },
  { href: "/dashboard/costs", label: "Costs", icon: DollarSign },
  { href: "/dashboard/audit", label: "Audit Log", icon: ScrollText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface DashboardSidebarProps {
  ownerName?: string;
  ownerAvatar?: string;
  hitlPendingCount?: number;
  className?: string;
}

export function DashboardSidebar({
  ownerName = "Owner",
  ownerAvatar,
  hitlPendingCount = 0,
  className,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn("hidden md:flex w-[240px] shrink-0 flex-col h-[calc(100vh-60px)]", className)}
      style={{
        backgroundColor: "var(--panel)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Owner info */}
      <div
        className="flex items-center gap-2.5 px-4 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="flex items-center justify-center w-8 h-8 text-sm"
          style={{
            backgroundColor: "var(--panel2)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
          }}
        >
          {ownerAvatar ?? "👤"}
        </span>
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--text)",
          }}
        >
          {ownerName}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {SIDEBAR_LINKS.map((link) => {
          const isActive =
            link.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname?.startsWith(link.href);
          const Icon = link.icon;
          const showBadge = link.badgeKey === "hitl" && hitlPendingCount > 0;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2 transition-colors duration-150 relative",
              )}
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                color: isActive ? "var(--text)" : "var(--dim)",
                backgroundColor: isActive ? "var(--panel2)" : "transparent",
                textDecoration: "none",
                borderLeft: isActive ? "3px solid var(--amber)" : "3px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--dim)";
              }}
            >
              <Icon size={16} />
              <span>{link.label}</span>
              {showBadge && (
                <span
                  className="ml-auto px-1.5 py-px text-[9px]"
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    color: "var(--red)",
                    backgroundColor: "var(--red-bg)",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: "var(--red-br)",
                  }}
                >
                  {hitlPendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-4 py-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <Link
          href="/feed"
          className="flex items-center gap-1.5 transition-colors duration-150"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "11px",
            color: "var(--dim)",
            textDecoration: "none",
          }}
        >
          <ExternalLink size={12} />
          View Public Feed →
        </Link>
        <div
          className="mt-1"
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "8px",
            color: "var(--dimmer)",
          }}
        >
          v0.1.0
        </div>
      </div>
    </aside>
  );
}
