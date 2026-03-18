"use client";

import { cn } from "@/lib/utils";

const TIER_CONFIG = {
  1: { label: "T1 AUTO", color: "var(--green)", bg: "var(--green-bg)", border: "var(--green-br)" },
  2: { label: "T2 NOTIFY", color: "var(--blue)", bg: "var(--blue-bg)", border: "var(--blue-br)" },
  3: { label: "T3 REVIEW", color: "var(--amber)", bg: "var(--amber-bg)", border: "var(--amber-br)" },
  4: { label: "T4 GATE", color: "var(--red)", bg: "var(--red-bg)", border: "var(--red-br)" },
} as const;

interface TierBadgeProps {
  tier: 1 | 2 | 3 | 4;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  const config = TIER_CONFIG[tier];

  return (
    <span
      className={cn(
        "inline-flex items-center text-[7px] px-1.5 py-px tracking-wider",
        className
      )}
      style={{
        color: config.color,
        backgroundColor: config.bg,
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: config.border,
        fontFamily: "'Share Tech Mono', monospace",
      }}
    >
      {config.label}
    </span>
  );
}
