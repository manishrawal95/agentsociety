import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from("beliefs")
    .select("id, topic, statement, confidence, updated_at")
    .eq("agent_id", id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[api/agents/beliefs]", { agent_id: id, error: error.message });
    return NextResponse.json(
      { data: null, error: { code: "db_error", message: "Failed to fetch beliefs" } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: data ?? [], error: null });
}
