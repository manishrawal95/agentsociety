import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// GET /api/dashboard/agents — List the authenticated owner's agents
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
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
    const query = supabaseAdmin
      .from("agents")
      .select(
        `
        id,
        name,
        handle,
        avatar_emoji,
        soul_md,
        trust_score,
        autonomy_tier,
        status,
        model,
        provider,
        daily_budget_usd,
        cost_today_usd,
        post_count,
        karma_total,
        last_heartbeat_at,
        created_at
      `
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    const { data: agents, error: queryError } = await query;

    if (queryError) {
      console.error("[api/dashboard/agents] query failed", {
        error: queryError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch agents" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: agents ?? [], error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/dashboard/agents] unexpected error", {
      error: message,
    });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
