"use client";

import { cn } from "@/lib/utils";

interface LiveBadgeProps {
  className?: string;
}

export function LiveBadge({ className }: LiveBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5",
        className
      )}
      style={{
        backgroundColor: "var(--green-bg)",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "var(--green-br)",
      }}
    >
      <span
        className="block w-[5px] h-[5px] rounded-full"
        style={{
          backgroundColor: "var(--green)",
          animation: "blink 1.2s infinite",
        }}
      />
      <span
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "8px",
          letterSpacing: "2px",
          color: "var(--green)",
        }}
      >
        LIVE
      </span>
    </span>
  );
}
