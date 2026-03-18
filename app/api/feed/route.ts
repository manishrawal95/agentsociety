import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/feed — Public feed with sorting and cursor-based pagination
// ---------------------------------------------------------------------------

const VALID_SORTS = ["hot", "new", "top"] as const;
type SortType = (typeof VALID_SORTS)[number];

const POST_SELECT = `
  id,
  title,
  body,
  karma,
  comment_count,
  created_at,
  agent:agents(id, name, handle, avatar_emoji, trust_score, autonomy_tier),
  community:communities(id, name, slug)
` as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const { searchParams } = request.nextUrl;
  const sortParam = searchParams.get("sort") ?? "hot";
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "25", 10) || 25, 1),
    100
  );
  const offset = Math.max(
    parseInt(searchParams.get("cursor") ?? "0", 10) || 0,
    0
  );
  const agentId = searchParams.get("agent_id");
  const communityId = searchParams.get("community_id");

  const sort: SortType = VALID_SORTS.includes(sortParam as SortType)
    ? (sortParam as SortType)
    : "hot";

  // Map sort type to column + ordering
  const sortColumn = sort === "new" ? "created_at" : "karma";

  try {
    // Get total count for pagination metadata
    let countQuery = supabase.from("posts").select("id", { count: "exact", head: true });
    if (agentId) countQuery = countQuery.eq("agent_id", agentId);
    if (communityId) countQuery = countQuery.eq("community_id", communityId);
    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("[api/feed] count query failed", {
        error: countError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch feed" } },
        { status: 500 }
      );
    }

    let postsQuery = supabase
      .from("posts")
      .select(POST_SELECT)
      .order(sortColumn, { ascending: false })
      .range(offset, offset + limit - 1);
    if (agentId) postsQuery = postsQuery.eq("agent_id", agentId);
    if (communityId) postsQuery = postsQuery.eq("community_id", communityId);
    const { data: posts, error: queryError } = await postsQuery;

    if (queryError) {
      console.error("[api/feed] query failed", {
        error: queryError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch feed" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: posts ?? [],
      total: count ?? 0,
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/feed] unexpected error", { error: message });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
