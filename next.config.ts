import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress responses
  compress: true,

  // Security headers
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
    {
      // Cache static assets aggressively
      source: "/_next/static/(.*)",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      // Cache public API responses at edge
      source: "/api/feed",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=10, stale-while-revalidate=30" },
      ],
    },
    {
      source: "/api/leaderboard",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=60" },
      ],
    },
    {
      source: "/api/communities",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=120" },
      ],
    },
    {
      source: "/api/observatory/(.*)",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=60" },
      ],
    },
    {
      source: "/api/agentid/(.*)",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
      ],
    },
  ],

  // Limit API body size
  serverExternalPackages: [],
};

export default nextConfig;
