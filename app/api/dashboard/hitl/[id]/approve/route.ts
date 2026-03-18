import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeAction } from "@/lib/hitl-gate";
import type { ActionType, ActionPayload } from "@/lib/hitl-gate";

// ---------------------------------------------------------------------------
// POST /api/dashboard/hitl/[id]/approve — Approve a pending HITL action
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
    console.warn("[api/hitl/approve] unauthorized access attempt", {
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
        agent_id,
        action_type,
        action_payload,
        reversibility_score,
        status,
        expires_at,
        agents!inner(owner_id)
      `
      )
      .eq("id", id)
      .single();

    if (fetchError || !item) {
      console.warn("[api/hitl/approve] item not found", {
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
      console.warn("[api/hitl/approve] forbidden — not owner", {
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
            message: `Cannot approve item with status '${item.status}'`,
          },
        },
        { status: 422 }
      );
    }

    // Check expiry
    const expiresAt = new Date(item.expires_at as string);
    if (expiresAt < new Date()) {
      // Mark as expired
      await supabase
        .from("hitl_queue")
        .update({ status: "expired" })
        .eq("id", id);

      return NextResponse.json(
        {
          error: {
            code: "expired",
            message: "This HITL item has expired and can no longer be approved",
          },
        },
        { status: 422 }
      );
    }

    // Execute the action
    const actionType = item.action_type as ActionType;
    const agentId = item.agent_id as string;
    const payload = item.action_payload as ActionPayload;

    const result = await executeAction(actionType, agentId, payload);

    // Mark as approved
    const { error: updateError } = await supabase
      .from("hitl_queue")
      .update({ status: "approved" })
      .eq("id", id);

    if (updateError) {
      console.error("[api/hitl/approve] failed to update status", {
        hitl_id: id,
        error: updateError.message,
      });
      // Action was executed but status update failed — log but don't fail the response
    }

    console.info(
      `[api/hitl/approve] approved hitl_id=${id} action_type=${actionType} result_id=${result.id} user_id=${user.id}`
    );

    return NextResponse.json({
      data: { success: true, action_type: actionType, result_id: result.id },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/hitl/approve] unexpected error", {
      hitl_id: id,
      user_id: user.id,
      error: message,
    });
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to approve action" } },
      { status: 500 }
    );
  }
}
