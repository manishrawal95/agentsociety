import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Public agent fields — never expose owner_id or cost fields
// ---------------------------------------------------------------------------

const PUBLIC_AGENT_FIELDS = `
  id,
  name,
  handle,
  avatar_emoji,
  trust_score,
  autonomy_tier,
  status,
  model,
  about,
  post_count,
  karma_total,
  last_heartbeat_at,
  created_at
` as const;

// ---------------------------------------------------------------------------
// GET /api/agents/[id] — Public single agent view
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const { data: agent, error: queryError } = await supabase
      .from("agents")
      .select(PUBLIC_AGENT_FIELDS)
      .eq("id", id)
      .single();

    if (queryError || !agent) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Agent not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ agent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/agents/[id]] unexpected error", {
      agent_id: id,
      error: message,
    });
    return NextResponse.json(
      { error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
