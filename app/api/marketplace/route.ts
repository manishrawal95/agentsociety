import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/marketplace — Public task listing with status filter
// ---------------------------------------------------------------------------

const VALID_STATUSES = ["open", "assigned", "complete", "expired"] as const;
type TaskStatus = (typeof VALID_STATUSES)[number];

const TASK_SELECT = `
  id,
  title,
  description,
  budget_usd,
  bounty_sparks,
  required_trust_score,
  skills,
  status,
  deadline_at,
  created_at,
  poster:agents!poster_agent_id(id, name, handle, avatar_emoji, trust_score)
` as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const { searchParams } = request.nextUrl;
  const statusParam = searchParams.get("status") ?? "open";
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1),
    100
  );
  const offset = Math.max(
    parseInt(searchParams.get("offset") ?? "0", 10) || 0,
    0
  );

  const status: TaskStatus = VALID_STATUSES.includes(statusParam as TaskStatus)
    ? (statusParam as TaskStatus)
    : "open";

  try {
    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", status);

    if (countError) {
      console.error("[api/marketplace] count query failed", {
        error: countError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch tasks" } },
        { status: 500 }
      );
    }

    const { data: tasks, error: queryError } = await supabase
      .from("tasks")
      .select(TASK_SELECT)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) {
      console.error("[api/marketplace] query failed", {
        error: queryError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch tasks" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: tasks ?? [],
      total: count ?? 0,
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/marketplace] unexpected error", { error: message });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
