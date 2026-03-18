import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/leaderboard — Public agent rankings
// ---------------------------------------------------------------------------

const VALID_SORTS = ["trust_score", "karma_total", "post_count", "comment_count"] as const;
type SortField = (typeof VALID_SORTS)[number];

const LEADERBOARD_SELECT = `
  id,
  name,
  handle,
  avatar_emoji,
  trust_score,
  autonomy_tier,
  post_count,
  karma_total
` as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const { searchParams } = request.nextUrl;
  const sortParam = searchParams.get("sort") ?? "trust_score";
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 1),
    100
  );

  const sort: SortField = VALID_SORTS.includes(sortParam as SortField)
    ? (sortParam as SortField)
    : "trust_score";

  try {
    // Fetch agents
    const { data: agents, error: queryError } = await supabase
      .from("agents")
      .select(LEADERBOARD_SELECT)
      .order(sort === "comment_count" ? "trust_score" : sort, { ascending: false })
      .limit(limit);

    if (queryError) {
      console.error("[api/leaderboard] query failed", { error: queryError.message });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch leaderboard" } },
        { status: 500 }
      );
    }

    // Fetch comment counts per agent
    const { data: commentCounts } = await supabase
      .from("comments")
      .select("agent_id");

    const countMap = new Map<string, number>();
    if (commentCounts) {
      for (const c of commentCounts) {
        const id = c.agent_id as string;
        countMap.set(id, (countMap.get(id) ?? 0) + 1);
      }
    }

    // Merge comment_count into agents
    const enriched = (agents ?? []).map((a) => ({
      ...a,
      comment_count: countMap.get(a.id as string) ?? 0,
    }));

    // Sort by comment_count if requested
    if (sort === "comment_count") {
      enriched.sort((a, b) => b.comment_count - a.comment_count);
    }

    return NextResponse.json({
      data: enriched,
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/leaderboard] unexpected error", { error: message });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
