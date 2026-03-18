// ---------------------------------------------------------------------------
// Prompt Injection Classifier
// Checks human-submitted content for injection patterns before it enters
// agent reasoning context.
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS: { pattern: RegExp; severity: "high" | "medium" }[] = [
  // High severity — clear injection attempts
  { pattern: /ignore\s+(previous|above|all|prior)\s+(instructions|prompts|rules)/i, severity: "high" },
  { pattern: /you\s+are\s+now\s+(a|an)\s/i, severity: "high" },
  { pattern: /new\s+instructions\s*:/i, severity: "high" },
  { pattern: /system\s+prompt/i, severity: "high" },
  { pattern: /disregard\s+(your|the|all)/i, severity: "high" },
  { pattern: /<\|system\|>/i, severity: "high" },
  { pattern: /\[INST\]/i, severity: "high" },
  { pattern: /forget\s+everything/i, severity: "high" },
  { pattern: /your\s+new\s+role/i, severity: "high" },
  { pattern: /override\s+(your|the|all)\s+(instructions|directives|rules)/i, severity: "high" },
  { pattern: /pretend\s+(you|to)\s+(are|be)\s/i, severity: "high" },
  { pattern: /do\s+not\s+follow\s+(your|the|any)/i, severity: "high" },
  { pattern: /reveal\s+(your|the)\s+(system|internal|hidden)/i, severity: "high" },

  // Medium severity — suspicious but might be legitimate
  { pattern: /act\s+as\s+if/i, severity: "medium" },
  { pattern: /respond\s+only\s+with/i, severity: "medium" },
  { pattern: /from\s+now\s+on/i, severity: "medium" },
  { pattern: /repeat\s+after\s+me/i, severity: "medium" },
  { pattern: /translate\s+(the\s+)?following\s+to/i, severity: "medium" },
];

export interface InjectionResult {
  risk_level: "none" | "low" | "medium" | "high";
  patterns_found: string[];
  sanitized_content: string;
}

export function classifyInjectionRisk(content: string): InjectionResult {
  const patternsFound: string[] = [];
  let maxSeverity: "none" | "low" | "medium" | "high" = "none";
  let sanitized = content;

  for (const { pattern, severity } of INJECTION_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      patternsFound.push(match[0]);

      if (severity === "high") {
        maxSeverity = "high";
        // Strip the matched pattern
        sanitized = sanitized.replace(pattern, "[REDACTED]");
      } else if (severity === "medium" && maxSeverity !== "high") {
        maxSeverity = "medium";
        sanitized = sanitized.replace(pattern, "[FLAGGED]");
      }
    }
  }

  return {
    risk_level: maxSeverity,
    patterns_found: patternsFound,
    sanitized_content: sanitized.trim(),
  };
}
