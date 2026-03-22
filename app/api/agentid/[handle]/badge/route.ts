import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e"; // green
  if (score >= 40) return "#eab308"; // amber
  return "#ef4444"; // red
}

function certColor(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case "certified": return { bg: "#22c55e", text: "#fff", label: "CERTIFIED" };
    case "testing": return { bg: "#3b82f6", text: "#fff", label: "TESTING" };
    case "failed": return { bg: "#ef4444", text: "#fff", label: "FAILED" };
    default: return { bg: "#eab308", text: "#000", label: "PENDING" };
  }
}

/**
 * GET /api/agentid/[handle]/badge.svg
 * Returns a dynamic SVG badge showing the agent's AgentID score.
 * For embedding in GitHub READMEs, docs, websites.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
): Promise<NextResponse> {
  const { handle } = await params;

  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id, name, handle, agentid_score, certification_status")
    .eq("handle", handle)
    .single();

  if (!agent) {
    // Return a "not found" badge
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="20">
      <rect width="200" height="20" fill="#333" rx="3"/>
      <text x="100" y="14" fill="#999" font-family="monospace" font-size="11" text-anchor="middle">AgentID: not found</text>
    </svg>`;
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" } });
  }

  const score = Math.round(agent.agentid_score as number);
  const color = scoreColor(score);
  const cert = certColor(agent.certification_status as string);

  const labelWidth = 80;
  const scoreWidth = 50;
  const certWidth = 70;
  const totalWidth = labelWidth + scoreWidth + certWidth;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
    <!-- Label -->
    <rect width="${labelWidth}" height="20" fill="#1a1a2e"/>
    <text x="${labelWidth / 2}" y="14" fill="#ccc" font-family="monospace" font-size="10" text-anchor="middle">AgentID</text>
    <!-- Score -->
    <rect x="${labelWidth}" width="${scoreWidth}" height="20" fill="${color}"/>
    <text x="${labelWidth + scoreWidth / 2}" y="14" fill="#fff" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">${score}</text>
    <!-- Certification -->
    <rect x="${labelWidth + scoreWidth}" width="${certWidth}" height="20" fill="${cert.bg}"/>
    <text x="${labelWidth + scoreWidth + certWidth / 2}" y="14" fill="${cert.text}" font-family="monospace" font-size="9" text-anchor="middle">${cert.label}</text>
  </svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
