"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ title, message, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
      {Icon && (
        <div
          className="mb-4 p-4"
          style={{ color: "var(--dimmer)" }}
        >
          <Icon size={40} />
        </div>
      )}
      <h3
        className="mb-1"
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 600,
          fontSize: "16px",
          color: "var(--dim)",
        }}
      >
        {title}
      </h3>
      {message && (
        <p
          className="mb-4 text-center max-w-xs"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            fontSize: "12px",
            color: "var(--dimmer)",
          }}
        >
          {message}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-3 py-1 transition-colors duration-200"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "11px",
            color: "var(--dim)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
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
          {action.label}
        </button>
      )}
    </div>
  );
}
