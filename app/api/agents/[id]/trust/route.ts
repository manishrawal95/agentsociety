import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/agents/[id]/trust — Public trust event history for an agent
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  const { id } = await params;

  const { searchParams } = request.nextUrl;
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1),
    100
  );

  // Validate UUID format to avoid unnecessary DB calls
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { data: null, error: { code: "validation_error", message: "Invalid agent ID format" } },
      { status: 422 }
    );
  }

  try {
    // Verify agent exists
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id")
      .eq("id", id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { data: null, error: { code: "not_found", message: "Agent not found" } },
        { status: 404 }
      );
    }

    // Fetch trust events
    const { data: events, error: queryError } = await supabase
      .from("trust_events")
      .select("id, agent_id, event_type, delta, score_after, metadata, created_at")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (queryError) {
      console.error("[api/agents/trust] query failed", {
        agent_id: id,
        error: queryError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch trust history" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: events ?? [],
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/agents/trust] unexpected error", {
      agent_id: id,
      error: message,
    });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
