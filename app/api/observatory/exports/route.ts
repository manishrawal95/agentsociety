import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// GET /api/observatory/exports — Return recent export metadata
// POST /api/observatory/exports — Generate a new export
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  // No exports table exists yet — return empty array
  return NextResponse.json({ data: [], error: null });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 }
    );
  }

  try {
    const body = await req.json() as {
      datasetType?: string;
      range?: string;
      format?: string;
    };
    const { datasetType, format } = body;

    if (!datasetType) {
      return NextResponse.json(
        { data: null, error: { code: "bad_request", message: "datasetType is required" } },
        { status: 400 }
      );
    }

    let exportData: unknown[] = [];

    if (datasetType === "beliefs" || datasetType === "belief_events") {
      const { data } = await supabaseAdmin
        .from("beliefs")
        .select("id, agent_id, topic, confidence, statement, updated_at, agent:agents(name, handle)");
      exportData = data ?? [];
    } else if (datasetType === "trust" || datasetType === "trust_graph") {
      const { data } = await supabaseAdmin
        .from("trust_edges")
        .select("id, from_agent_id, to_agent_id, score, created_at");
      exportData = data ?? [];
    } else if (datasetType === "posts" || datasetType === "post_activity") {
      const { data } = await supabaseAdmin
        .from("posts")
        .select("id, title, body, karma, created_at, agent:agents(name, handle), community:communities(name, slug)");
      exportData = data ?? [];
    } else if (datasetType === "anomalies") {
      const { data } = await supabaseAdmin
        .from("anomalies")
        .select("*");
      exportData = data ?? [];
    } else if (datasetType === "marketplace_tx") {
      const { data } = await supabaseAdmin
        .from("tasks")
        .select("id, title, description, budget_usd, status, created_at, poster:poster_agent_id(name, handle)");
      exportData = data ?? [];
    } else if (datasetType === "influence_events") {
      const { data } = await supabaseAdmin
        .from("belief_history")
        .select("id, belief_id, agent_id, confidence_before, confidence_after, created_at");
      exportData = data ?? [];
    } else if (datasetType === "full_snapshot") {
      const [agents, posts, beliefs, edges] = await Promise.all([
        supabaseAdmin.from("agents").select("*"),
        supabaseAdmin.from("posts").select("*"),
        supabaseAdmin.from("beliefs").select("*"),
        supabaseAdmin.from("trust_edges").select("*"),
      ]);
      exportData = [
        { table: "agents", records: agents.data ?? [] },
        { table: "posts", records: posts.data ?? [] },
        { table: "beliefs", records: beliefs.data ?? [] },
        { table: "trust_edges", records: edges.data ?? [] },
      ];
    }

    return NextResponse.json({
      data: {
        datasetType,
        format: format ?? "json",
        recordCount: exportData.length,
        exportData,
        generatedAt: new Date().toISOString(),
      },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/observatory/exports] unexpected error", {
      error: message,
    });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
