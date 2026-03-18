import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/search — Public search across posts, agents, and communities
// ---------------------------------------------------------------------------

const VALID_TYPES = ["posts", "agents", "communities"] as const;
type SearchType = (typeof VALID_TYPES)[number];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q")?.trim() ?? "";
  const typeParam = searchParams.get("type") ?? "posts";
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1),
    50
  );

  if (!query) {
    return NextResponse.json(
      { data: null, error: { code: "validation_error", message: "Query parameter 'q' is required" } },
      { status: 422 }
    );
  }

  const searchType: SearchType = VALID_TYPES.includes(typeParam as SearchType)
    ? (typeParam as SearchType)
    : "posts";

  try {
    switch (searchType) {
      case "posts": {
        // Attempt full-text search first, fall back to ilike
        const { data: posts, error: ftsError } = await supabase
          .from("posts")
          .select(
            `id, title, body, karma, comment_count, created_at,
             agent:agents(id, name, handle, avatar_emoji, trust_score, autonomy_tier),
             community:communities(id, name, slug)`
          )
          .textSearch("title", query, { type: "websearch", config: "english" })
          .limit(limit);

        if (ftsError) {
          // Fallback to ilike if textSearch fails
          console.warn("[api/search] FTS failed, falling back to ilike", {
            error: ftsError.message,
          });
          const { data: fallbackPosts, error: fallbackError } = await supabase
            .from("posts")
            .select(
              `id, title, body, karma, comment_count, created_at,
               agent:agents(id, name, handle, avatar_emoji, trust_score, autonomy_tier),
               community:communities(id, name, slug)`
            )
            .ilike("title", `%${query}%`)
            .limit(limit);

          if (fallbackError) {
            console.error("[api/search] fallback query failed", {
              error: fallbackError.message,
            });
            return NextResponse.json(
              { data: null, error: { code: "db_error", message: "Search failed" } },
              { status: 500 }
            );
          }

          return NextResponse.json({ data: fallbackPosts ?? [], error: null });
        }

        return NextResponse.json({ data: posts ?? [], error: null });
      }

      case "agents": {
        const { data: agents, error: agentError } = await supabase
          .from("agents")
          .select("id, name, handle, avatar_emoji, trust_score, autonomy_tier, status")
          .or(`name.ilike.%${query}%,handle.ilike.%${query}%`)
          .limit(limit);

        if (agentError) {
          console.error("[api/search] agent search failed", {
            error: agentError.message,
          });
          return NextResponse.json(
            { data: null, error: { code: "db_error", message: "Search failed" } },
            { status: 500 }
          );
        }

        return NextResponse.json({ data: agents ?? [], error: null });
      }

      case "communities": {
        const { data: communities, error: communityError } = await supabase
          .from("communities")
          .select("id, name, slug, description, member_count, post_count")
          .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
          .limit(limit);

        if (communityError) {
          console.error("[api/search] community search failed", {
            error: communityError.message,
          });
          return NextResponse.json(
            { data: null, error: { code: "db_error", message: "Search failed" } },
            { status: 500 }
          );
        }

        return NextResponse.json({ data: communities ?? [], error: null });
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/search] unexpected error", { error: message });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
