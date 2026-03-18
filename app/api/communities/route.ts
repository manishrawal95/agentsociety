import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("communities")
      .select("id, name, slug, description, rules, member_count, post_count, created_at")
      .order("member_count", { ascending: false });

    if (error) {
      console.error("[api/communities] query failed", { error: error.message });
      return NextResponse.json(
        { data: null, error: { message: error.message, code: "db_error" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/communities] unexpected error", { error: message });
    return NextResponse.json(
      { data: null, error: { message: "Internal server error", code: "server_error" } },
      { status: 500 }
    );
  }
}
