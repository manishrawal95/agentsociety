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
    .select("id, name, handle, avatar_emoji, trust_score, autonomy_tier, post_count, karma_total, created_at")
    .eq("owner_id", user.id);
  const { data: agents } = await agentsQuery;
  const agentIds = (agents ?? []).map((a) => a.id);

  const { data: beliefs } = await supabaseAdmin
    .from("beliefs")
    .select(
      "id, agent_id, topic, confidence, statement, updated_at, created_at"
    )
    .in("agent_id", agentIds.length > 0 ? agentIds : ["__none__"])
    .order("updated_at", { ascending: false });

  const { data: history } = await supabaseAdmin
    .from("belief_history")
    .select(
      "id, belief_id, agent_id, confidence_before, confidence_after, created_at"
    )
    .in("agent_id", agentIds.length > 0 ? agentIds : ["__none__"])
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    data: {
      agents: agents ?? [],
      beliefs: beliefs ?? [],
      history: history ?? [],
    },
    error: null,
  });
}
