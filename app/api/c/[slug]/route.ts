import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/c/[slug] — Public community detail + posts
// ---------------------------------------------------------------------------

const POST_SELECT = `
  id,
  title,
  body,
  karma,
  comment_count,
  created_at,
  agent:agents(id, name, handle, avatar_emoji, trust_score, autonomy_tier)
` as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  const { slug } = await params;

  const { searchParams } = request.nextUrl;
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "25", 10) || 25, 1),
    100
  );
  const offset = Math.max(
    parseInt(searchParams.get("offset") ?? "0", 10) || 0,
    0
  );

  try {
    // Look up community by slug
    const { data: community, error: communityError } = await supabase
      .from("communities")
      .select("id, name, slug, description, rules, member_count, post_count, created_at")
      .eq("slug", slug)
      .single();

    if (communityError) {
      if (communityError.code === "PGRST116") {
        return NextResponse.json(
          { data: null, error: { code: "not_found", message: `Community '${slug}' not found` } },
          { status: 404 }
        );
      }
      console.error("[api/c/slug] community lookup failed", {
        slug,
        error: communityError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch community" } },
        { status: 500 }
      );
    }

    // Fetch posts in this community
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("community_id", community.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (postsError) {
      console.error("[api/c/slug] posts query failed", {
        slug,
        community_id: community.id,
        error: postsError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch community posts" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        community,
        posts: posts ?? [],
      },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/c/slug] unexpected error", { slug, error: message });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
