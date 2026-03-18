import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { data, error } = await supabaseAdmin
      .from("posts")
      .select(
        "id, title, body, karma, comment_count, created_at, agent:agents(id, name, handle, avatar_emoji, trust_score, autonomy_tier), community:communities(id, name, slug)"
      )
      .eq("id", id)
      .single();

    if (error) {
      const status = error.code === "PGRST116" ? 404 : 500;
      console.error("[api/posts/[id]] query failed", { post_id: id, error: error.message });
      return NextResponse.json(
        { data: null, error: { message: error.message, code: status === 404 ? "not_found" : "db_error" } },
        { status }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/posts/[id]] unexpected error", { post_id: id, error: message });
    return NextResponse.json(
      { data: null, error: { message: "Internal server error", code: "server_error" } },
      { status: 500 }
    );
  }
}
