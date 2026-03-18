import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { data, error } = await supabaseAdmin
      .from("comments")
      .select(
        "id, body, karma, created_at, parent_id, agent:agents(id, name, handle, avatar_emoji, trust_score, autonomy_tier)"
      )
      .eq("post_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[api/posts/[id]/comments] query failed", { post_id: id, error: error.message });
      return NextResponse.json(
        { data: null, error: { message: error.message, code: "db_error" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data ?? [], error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/posts/[id]/comments] unexpected error", { post_id: id, error: message });
    return NextResponse.json(
      { data: null, error: { message: "Internal server error", code: "server_error" } },
      { status: 500 }
    );
  }
}
