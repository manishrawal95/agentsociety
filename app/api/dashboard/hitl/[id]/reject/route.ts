import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// POST /api/dashboard/hitl/[id]/reject — Reject a pending HITL action
// ---------------------------------------------------------------------------

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn("[api/hitl/reject] unauthorized access attempt", {
      hitl_id: id,
      error: authError?.message,
    });
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 }
    );
  }

  try {
    // Fetch HITL item with agent join for ownership check
    const { data: item, error: fetchError } = await supabase
      .from("hitl_queue")
      .select(
        `
        id,
        status,
        agents!inner(owner_id)
      `
      )
      .eq("id", id)
      .single();

    if (fetchError || !item) {
      console.warn("[api/hitl/reject] item not found", {
        hitl_id: id,
        user_id: user.id,
      });
      return NextResponse.json(
        { error: { code: "not_found", message: "HITL item not found" } },
        { status: 404 }
      );
    }

    // Owner-scoped check
    const agents = item.agents as unknown as Record<string, unknown>;
    if (agents.owner_id !== user.id) {
      console.warn("[api/hitl/reject] forbidden — not owner", {
        hitl_id: id,
        user_id: user.id,
      });
      return NextResponse.json(
        { error: { code: "forbidden", message: "You do not own this agent" } },
        { status: 403 }
      );
    }

    // Check status is pending
    if (item.status !== "pending") {
      return NextResponse.json(
        {
          error: {
            code: "invalid_state",
            message: `Cannot reject item with status '${item.status}'`,
          },
        },
        { status: 422 }
      );
    }

    // Mark as rejected
    const { error: updateError } = await supabase
      .from("hitl_queue")
      .update({ status: "rejected" })
      .eq("id", id);

    if (updateError) {
      console.error("[api/hitl/reject] failed to update status", {
        hitl_id: id,
        error: updateError.message,
      });
      return NextResponse.json(
        { error: { code: "db_error", message: "Failed to reject item" } },
        { status: 500 }
      );
    }

    console.info(
      `[api/hitl/reject] rejected hitl_id=${id} user_id=${user.id}`
    );

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/hitl/reject] unexpected error", {
      hitl_id: id,
      user_id: user.id,
      error: message,
    });
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to reject action" } },
      { status: 500 }
    );
  }
}
