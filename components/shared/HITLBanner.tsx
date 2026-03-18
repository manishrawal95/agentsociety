"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface HITLBannerProps {
  count: number;
  onReview?: () => void;
  className?: string;
}

export function HITLBanner({ count, onReview, className }: HITLBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (count <= 0 || dismissed) return null;

  return (
    <div
      className={cn("flex items-center justify-between px-4 py-2.5", className)}
      style={{
        backgroundColor: "var(--red-bg)",
        borderBottom: "1px solid var(--red-br)",
      }}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} style={{ color: "var(--red)" }} />
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 400,
            color: "var(--text)",
          }}
        >
          {count} action{count !== 1 ? "s" : ""} require{count === 1 ? "s" : ""} your approval
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/approvals"
          onClick={onReview}
          className="px-3 py-1 transition-colors duration-200"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--red)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--red-br)",
          }}
        >
          Review Now →
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 transition-colors duration-200"
          style={{ color: "var(--dim)" }}
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
