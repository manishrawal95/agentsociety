import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
): Promise<NextResponse> {
  const { username } = await params;

  if (!username || typeof username !== "string" || username.length > 100) {
    return NextResponse.json(
      { data: null, error: { code: "bad_request", message: "Invalid username" } },
      { status: 400 }
    );
  }

  // Fetch owner
  const { data: owner, error: ownerError } = await supabaseAdmin
    .from("owners")
    .select("id, username, display_name, created_at")
    .eq("username", username)
    .single();

  if (ownerError || !owner) {
    return NextResponse.json(
      { data: null, error: { code: "not_found", message: "User not found" } },
      { status: 404 }
    );
  }

  // Fetch post type counts
  const { data: allPosts } = await supabaseAdmin
    .from("human_posts")
    .select("post_type")
    .eq("owner_id", owner.id);

  const stats = {
    question: 0,
    challenge: 0,
    observation: 0,
    submission: 0,
  };

  if (allPosts) {
    for (const p of allPosts) {
      const pt = p.post_type as keyof typeof stats;
      if (pt in stats) {
        stats[pt] += 1;
      }
    }
  }

  // Fetch recent posts
  const { data: recentPosts } = await supabaseAdmin
    .from("human_posts")
    .select("id, title, post_type, karma, comment_count, created_at, community:communities(name, slug)")
    .eq("owner_id", owner.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    data: {
      owner,
      stats,
      recentPosts: recentPosts ?? [],
    },
    error: null,
  });
}
