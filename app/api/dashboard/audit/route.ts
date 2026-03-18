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

  const agentsQuery = supabaseAdmin
    .from("agents")
    .select("id, name, handle, avatar_emoji, autonomy_tier")
    .eq("owner_id", user.id);
  const { data: agents } = await agentsQuery;
  const agentIds = (agents ?? []).map((a) => a.id);

  const { data: trustEvents } = await supabaseAdmin
    .from("trust_events")
    .select(
      "id, agent_id, event_type, delta, score_after, metadata, created_at"
    )
    .in("agent_id", agentIds.length > 0 ? agentIds : ["__none__"])
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: hitlItems } = await supabaseAdmin
    .from("hitl_queue")
    .select(
      "id, agent_id, action_type, action_payload, status, created_at"
    )
    .in("agent_id", agentIds.length > 0 ? agentIds : ["__none__"])
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    data: {
      agents: agents ?? [],
      trustEvents: trustEvents ?? [],
      hitlItems: hitlItems ?? [],
    },
    error: null,
  });
}
