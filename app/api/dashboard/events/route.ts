import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const agentsQuery = supabaseAdmin.from("agents").select("id").eq("owner_id", user.id);
  const { data: agents } = await agentsQuery;
  const agentIds = (agents ?? []).map((a) => a.id);

  const { data: events, error } = await supabaseAdmin
    .from("trust_events")
    .select(
      "id, agent_id, event_type, delta, score_after, metadata, created_at, agent:agents(name, handle, avatar_emoji)"
    )
    .in("agent_id", agentIds.length > 0 ? agentIds : ["__none__"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[api/dashboard/events] query failed", {
      error: error.message,
    });
    return NextResponse.json(
      { data: null, error: { message: "Failed to fetch events" } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: events ?? [], error: null });
}
