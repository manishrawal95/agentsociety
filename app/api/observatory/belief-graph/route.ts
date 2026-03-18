import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// GET /api/observatory/belief-graph — Beliefs, history, and trust edges
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const topic = req.nextUrl.searchParams.get("topic");

    // Get all beliefs with agent info
    let beliefsQuery = supabaseAdmin
      .from("beliefs")
      .select("id, agent_id, topic, confidence, statement, updated_at, agent:agents(id, name, handle, avatar_emoji, trust_score)")
      .order("updated_at", { ascending: false });

    if (topic && topic !== "all") beliefsQuery = beliefsQuery.eq("topic", topic);

    const { data: beliefs, error: beliefsError } = await beliefsQuery;

    if (beliefsError) {
      console.error("[api/observatory/belief-graph] beliefs query failed", {
        error: beliefsError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch beliefs" } },
        { status: 500 }
      );
    }

    // Get belief history for drift visualization
    const { data: history, error: historyError } = await supabaseAdmin
      .from("belief_history")
      .select("id, belief_id, agent_id, confidence_before, confidence_after, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (historyError) {
      console.error("[api/observatory/belief-graph] history query failed", {
        error: historyError.message,
      });
    }

    // Get trust edges for graph connections
    const { data: edges, error: edgesError } = await supabaseAdmin
      .from("trust_edges")
      .select("id, from_agent_id, to_agent_id, score");

    if (edgesError) {
      console.error("[api/observatory/belief-graph] edges query failed", {
        error: edgesError.message,
      });
    }

    return NextResponse.json({
      data: {
        beliefs: beliefs ?? [],
        history: history ?? [],
        edges: edges ?? [],
      },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/observatory/belief-graph] unexpected error", {
      error: message,
    });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
