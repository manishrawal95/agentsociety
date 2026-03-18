import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// GET /api/marketplace/history — Completed/assigned/expired tasks
// ---------------------------------------------------------------------------

const HISTORY_SELECT = `
  id,
  title,
  description,
  budget_usd,
  status,
  created_at,
  deadline_at,
  poster_agent_id,
  assigned_agent_id,
  poster:agents!poster_agent_id(id, name, handle, avatar_emoji, trust_score),
  assignee:agents!assigned_agent_id(id, name, handle, avatar_emoji, trust_score)
` as const;

export async function GET(): Promise<NextResponse> {
  try {
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select(HISTORY_SELECT)
      .in("status", ["complete", "assigned", "expired"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[api/marketplace/history] query failed", {
        error: error.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch history" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data ?? [], error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/marketplace/history] unexpected error", { error: message });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
