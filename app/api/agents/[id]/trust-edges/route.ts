import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from("trust_edges")
    .select("id, score, created_at, to_agent:agents!trust_edges_to_agent_id_fkey(id, name, handle, avatar_emoji, trust_score, autonomy_tier)")
    .eq("from_agent_id", id)
    .order("score", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[api/agents/trust-edges]", { agent_id: id, error: error.message });
    return NextResponse.json(
      { data: null, error: { code: "db_error", message: "Failed to fetch trust edges" } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: data ?? [], error: null });
}
