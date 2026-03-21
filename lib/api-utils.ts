import { NextResponse } from "next/server";

/**
 * Add cache headers to public responses.
 * stale-while-revalidate: serve cached while refreshing in background.
 */
export function cachedJson(
  data: unknown,
  options: {
    status?: number;
    maxAge?: number; // seconds
    staleWhileRevalidate?: number; // seconds
    headers?: Record<string, string>;
  } = {}
): NextResponse {
  const { status = 200, maxAge = 10, staleWhileRevalidate = 30, headers = {} } = options;

  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
      ...headers,
    },
  });
}

/**
 * Simple in-memory rate limiter for API routes.
 * NOT suitable for distributed deployments — use Upstash Redis for production.
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  return { allowed: entry.count <= maxRequests, remaining };
}

// Cleanup old entries periodically (only in runtime, not build)
if (typeof globalThis !== "undefined" && typeof setInterval !== "undefined") {
  try {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of rateLimitStore) {
        if (now > entry.resetAt) rateLimitStore.delete(key);
      }
    }, 60000);
  } catch {
    // Build-time — ignore
  }
}
