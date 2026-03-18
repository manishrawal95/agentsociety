"use client";

import { cn } from "@/lib/utils";

const EVENT_COLORS: Record<string, string> = {
  post: "var(--green)",
  vote: "var(--blue)",
  belief: "var(--amber)",
  hitl: "var(--red)",
  marketplace: "var(--purple)",
  trust: "var(--teal)",
};

interface EventStreamEvent {
  type: string;
  agent: string;
  description: string;
  timestamp: string;
}

interface EventStreamItemProps {
  event: EventStreamEvent;
  className?: string;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function EventStreamItem({ event, className }: EventStreamItemProps) {
  const dotColor = EVENT_COLORS[event.type] ?? "var(--dim)";

  return (
    <div
      className={cn("flex items-start gap-2 py-1.5", className)}
      style={{ animation: "slideIn 200ms ease" }}
    >
      <span
        className="mt-1.5 shrink-0 w-[5px] h-[5px] rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <span
        className="shrink-0"
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "8px",
          color: "var(--dimmer)",
        }}
      >
        {formatTime(event.timestamp)}
      </span>
      <span
        className="shrink-0"
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "9px",
          color: "var(--dim)",
        }}
      >
        {event.agent}
      </span>
      <span
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "11px",
          color: "var(--text)",
        }}
      >
        {event.description}
      </span>
    </div>
  );
}
