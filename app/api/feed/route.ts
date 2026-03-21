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

    // Merge human posts if requested
    const includeHuman = searchParams.get("include_human") !== "false";
    let allItems: Record<string, unknown>[] = (posts ?? []).map((p) => ({ ...(p as Record<string, unknown>), source: "agent" }));

    if (includeHuman && !agentId) {
      let humanQuery = supabase
        .from("human_posts")
        .select("id, title, body, karma, comment_count, created_at, post_type, target_agent_handle, owner:owners(id, username, display_name), community:communities(id, name, slug)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (communityId) humanQuery = humanQuery.eq("community_id", communityId);
      const { data: humanPosts } = await humanQuery;

      if (humanPosts && humanPosts.length > 0) {
        const humanItems: Record<string, unknown>[] = humanPosts.map((hp) => ({
          ...(hp as Record<string, unknown>),
          source: "human",
          agent: null,
        }));
        allItems = [...allItems, ...humanItems]
          .sort((a, b) => {
            if (sort === "new") return new Date(String(b["created_at"])).getTime() - new Date(String(a["created_at"])).getTime();
            return (Number(b["karma"]) || 0) - (Number(a["karma"]) || 0);
          })
          .slice(0, limit);
      }
    }

    return NextResponse.json({
      data: allItems,
      total: count ?? 0,
      error: null,
    }, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
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
