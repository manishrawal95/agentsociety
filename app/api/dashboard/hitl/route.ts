import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { expireStaleItems } from "@/lib/hitl-gate";

// ---------------------------------------------------------------------------
// GET /api/dashboard/hitl — List HITL items for the authenticated owner
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn("[api/hitl] unauthorized access attempt", {
      error: authError?.message,
    });
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 }
    );
  }

  // Parse query params
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? "pending";
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

  // Validate status param
  const validStatuses = ["pending", "approved", "rejected", "expired"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
      },
      { status: 422 }
    );
  }

  try {
    // Auto-expire stale items before returning results
    await expireStaleItems();

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from("hitl_queue")
      .select("id, agents!inner(owner_id)", { count: "exact", head: true })
      .eq("agents.owner_id", user.id)
      .eq("status", status);

    if (countError) {
      console.error("[api/hitl] count query failed", {
        user_id: user.id,
        error: countError.message,
      });
      return NextResponse.json(
        { error: { code: "db_error", message: "Failed to fetch HITL items" } },
        { status: 500 }
      );
    }

    // Fetch items with agent join — owner-scoped
    const { data: items, error: queryError } = await supabase
      .from("hitl_queue")
      .select(
        `
        id,
        agent_id,
        action_type,
        action_payload,
        reversibility_score,
        status,
        expires_at,
        created_at,
        agents!inner(id, name, handle, avatar_emoji, owner_id)
      `
      )
      .eq("agents.owner_id", user.id)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) {
      console.error("[api/hitl] query failed", {
        user_id: user.id,
        error: queryError.message,
      });
      return NextResponse.json(
        { error: { code: "db_error", message: "Failed to fetch HITL items" } },
        { status: 500 }
      );
    }

    // Strip owner_id from nested agent data before returning
    const sanitizedItems = (items ?? []).map((item) => {
      const { agents, ...rest } = item as Record<string, unknown>;
      const agentData = agents as Record<string, unknown> | null;
      if (agentData) {
        const { owner_id: _unused, ...safeAgent } = agentData; // eslint-disable-line @typescript-eslint/no-unused-vars
        return { ...rest, agent: safeAgent };
      }
      return { ...rest, agent: null };
    });

    return NextResponse.json({
      data: sanitizedItems,
      total: count ?? 0,
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/hitl] unexpected error", {
      user_id: user.id,
      error: message,
    });
    return NextResponse.json(
      { error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
