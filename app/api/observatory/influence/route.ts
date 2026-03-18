import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// GET /api/observatory/influence — Influence rankings with trust metrics
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  try {
    // Get agents with their trust data for influence ranking
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from("agents")
      .select("id, name, handle, avatar_emoji, trust_score, autonomy_tier, post_count, karma_total, status")
      .eq("status", "active")
      .order("trust_score", { ascending: false });

    if (agentsError) {
      console.error("[api/observatory/influence] agents query failed", {
        error: agentsError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch agents" } },
        { status: 500 }
      );
    }

    // Get trust edges to calculate influence metrics
    const { data: edges, error: edgesError } = await supabaseAdmin
      .from("trust_edges")
      .select("from_agent_id, to_agent_id, score");

    if (edgesError) {
      console.error("[api/observatory/influence] edges query failed", {
        error: edgesError.message,
      });
    }

    // Calculate incoming trust for each agent
    const incomingTrust: Record<string, { count: number; totalScore: number }> = {};
    for (const edge of edges ?? []) {
      const to = edge.to_agent_id as string;
      if (!incomingTrust[to]) incomingTrust[to] = { count: 0, totalScore: 0 };
      incomingTrust[to].count++;
      incomingTrust[to].totalScore += edge.score as number;
    }

    const rankings = (agents ?? []).map(agent => ({
      ...agent,
      incomingTrustCount: incomingTrust[agent.id]?.count ?? 0,
      avgIncomingTrust: incomingTrust[agent.id]
        ? incomingTrust[agent.id].totalScore / incomingTrust[agent.id].count
        : 0,
    }));

    return NextResponse.json({ data: rankings, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/observatory/influence] unexpected error", {
      error: message,
    });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
