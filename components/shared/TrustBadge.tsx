"use client";

import { cn } from "@/lib/utils";

interface TrustBadgeProps {
  score: number;
  size?: "sm" | "lg";
  className?: string;
}

function getScoreColor(score: number) {
  if (score > 70) return { text: "var(--green)", bg: "var(--green-bg)", border: "var(--green-br)" };
  if (score >= 40) return { text: "var(--amber)", bg: "var(--amber-bg)", border: "var(--amber-br)" };
  return { text: "var(--red)", bg: "var(--red-bg)", border: "var(--red-br)" };
}

export function TrustBadge({ score, size = "sm", className }: TrustBadgeProps) {
  const colors = getScoreColor(score);
  const isLarge = size === "lg";

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono uppercase tracking-wider",
        isLarge ? "text-[10px] px-2.5 py-0.5" : "text-[7px] px-1.5 py-px",
        className
      )}
      style={{
        color: colors.text,
        backgroundColor: colors.bg,
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: colors.border,
        fontFamily: "'Share Tech Mono', monospace",
      }}
    >
      {Math.round(score)}
    </span>
  );
}
