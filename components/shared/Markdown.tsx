"use client";

import React from "react";

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer for agent-generated content.
 * Handles: **bold**, *italic*, `code`, - lists, numbered lists, ### headers, paragraphs.
 * No dangerouslySetInnerHTML — builds React elements directly.
 */
export function Markdown({ content, className }: MarkdownProps) {
  const blocks = content.split(/\n\n+/).filter((b) => b.trim().length > 0);

  return (
    <div className={className}>
      {blocks.map((block, i) => (
        <MarkdownBlock key={i} block={block.trim()} />
      ))}
    </div>
  );
}

function MarkdownBlock({ block }: { block: string }) {
  const lines = block.split("\n");

  // Header
  if (lines[0]?.startsWith("###")) {
    return (
      <h4
        className="mt-4 mb-2"
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 600,
          fontSize: "15px",
          color: "var(--text)",
        }}
      >
        {renderInline(lines[0].replace(/^#{1,4}\s*/, ""))}
      </h4>
    );
  }
  if (lines[0]?.startsWith("##")) {
    return (
      <h3
        className="mt-4 mb-2"
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 600,
          fontSize: "16px",
          color: "var(--text)",
        }}
      >
        {renderInline(lines[0].replace(/^#{1,3}\s*/, ""))}
      </h3>
    );
  }
  if (lines[0]?.startsWith("#")) {
    return (
      <h3
        className="mt-4 mb-2"
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: "18px",
          color: "var(--text)",
        }}
      >
        {renderInline(lines[0].replace(/^#\s*/, ""))}
      </h3>
    );
  }

  // Bullet list
  const isBulletList = lines.every((l) => /^\s*[-*]\s/.test(l) || l.trim() === "");
  if (isBulletList && lines.some((l) => /^\s*[-*]\s/.test(l))) {
    return (
      <ul className="my-2 space-y-1 list-none">
        {lines
          .filter((l) => /^\s*[-*]\s/.test(l))
          .map((l, i) => (
            <li
              key={i}
              className="flex gap-2"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                lineHeight: 1.7,
                color: "var(--text)",
              }}
            >
              <span style={{ color: "var(--dim)", flexShrink: 0 }}>&bull;</span>
              <span>{renderInline(l.replace(/^\s*[-*]\s*/, ""))}</span>
            </li>
          ))}
      </ul>
    );
  }

  // Numbered list
  const isNumberedList = lines.every((l) => /^\s*\d+[.)]\s/.test(l) || l.trim() === "");
  if (isNumberedList && lines.some((l) => /^\s*\d+[.)]\s/.test(l))) {
    return (
      <ol className="my-2 space-y-1 list-none">
        {lines
          .filter((l) => /^\s*\d+[.)]\s/.test(l))
          .map((l, i) => (
            <li
              key={i}
              className="flex gap-2"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                lineHeight: 1.7,
                color: "var(--text)",
              }}
            >
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "12px",
                  color: "var(--dim)",
                  flexShrink: 0,
                  minWidth: "16px",
                }}
              >
                {i + 1}.
              </span>
              <span>{renderInline(l.replace(/^\s*\d+[.)]\s*/, ""))}</span>
            </li>
          ))}
      </ol>
    );
  }

  // Regular paragraph
  return (
    <p
      className="my-2"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 400,
        fontSize: "14px",
        lineHeight: 1.8,
        color: "var(--text)",
      }}
    >
      {renderInline(block.replace(/\n/g, " "))}
    </p>
  );
}

/**
 * Renders inline markdown: **bold**, *italic*, `code`
 */
function renderInline(text: string): React.ReactNode {
  // Split by markdown patterns, preserving delimiters
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Italic: *text* (not preceded by *)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    // Code: `text`
    const codeMatch = remaining.match(/`([^`]+)`/);

    // Find earliest match
    const matches = [
      boldMatch ? { type: "bold" as const, match: boldMatch } : null,
      italicMatch ? { type: "italic" as const, match: italicMatch } : null,
      codeMatch ? { type: "code" as const, match: codeMatch } : null,
    ]
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => (a.match.index ?? 0) - (b.match.index ?? 0));

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0];
    const idx = first.match.index ?? 0;

    // Add text before match
    if (idx > 0) {
      parts.push(remaining.slice(0, idx));
    }

    // Add formatted element
    if (first.type === "bold") {
      parts.push(
        <strong key={key++} style={{ fontWeight: 600 }}>
          {first.match[1]}
        </strong>
      );
    } else if (first.type === "italic") {
      parts.push(
        <em key={key++} style={{ fontStyle: "italic" }}>
          {first.match[1]}
        </em>
      );
    } else {
      parts.push(
        <code
          key={key++}
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "12px",
            backgroundColor: "var(--panel2)",
            padding: "1px 4px",
          }}
        >
          {first.match[1]}
        </code>
      );
    }

    remaining = remaining.slice(idx + first.match[0].length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
