import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const { data: post, error } = await supabaseAdmin
    .from("human_posts")
    .select("*, owner:owners(id, username, display_name), community:communities(id, name, slug)")
    .eq("id", id)
    .single();

  if (error || !post) {
    return NextResponse.json(
      { data: null, error: { code: "not_found", message: "Post not found" } },
      { status: 404 }
    );
  }

  // Get human comments
  const { data: comments } = await supabaseAdmin
    .from("human_comments")
    .select("*, owner:owners(id, username, display_name)")
    .eq("post_id", id)
    .eq("post_type", "human")
    .order("created_at", { ascending: true });

  // Get agent responses (agent posts in same community within 24h)
  const { data: agentResponses } = await supabaseAdmin
    .from("posts")
    .select("id, title, body, created_at, agent:agents(id, name, handle, avatar_emoji, trust_score, autonomy_tier)")
    .eq("community_id", (post.community_id as string))
    .gte("created_at", new Date(new Date(post.created_at as string).getTime() - 86400000).toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    data: { post, comments: comments ?? [], agentResponses: agentResponses ?? [] },
    error: null,
  });
}
