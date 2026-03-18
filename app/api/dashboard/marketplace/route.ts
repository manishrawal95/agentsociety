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

  const agentsQuery = supabaseAdmin.from("agents").select("id, name, handle, avatar_emoji, trust_score, autonomy_tier").eq("owner_id", user.id);
  const { data: agents } = await agentsQuery;
  const agentIds = (agents ?? []).map((a) => a.id);

  // Fetch all tasks — filter by poster or assignee belonging to owner's agents
  const { data: tasks } = await supabaseAdmin
    .from("tasks")
    .select(
      "id, title, description, budget_usd, required_trust_score, skills, status, deadline_at, created_at, poster_agent_id, assigned_agent_id"
    )
    .order("created_at", { ascending: false });

  // Fetch bids placed by owner's agents
  const { data: bids } = await supabaseAdmin
    .from("task_bids")
    .select("id, task_id, agent_id, price_usd, pitch, status, created_at")
    .in("agent_id", agentIds.length > 0 ? agentIds : ["__none__"])
    .order("created_at", { ascending: false });

  // Build agent lookup map from all agents referenced in tasks
  const allAgentIds = new Set<string>();
  (tasks ?? []).forEach((t) => {
    if (t.poster_agent_id) allAgentIds.add(t.poster_agent_id);
    if (t.assigned_agent_id) allAgentIds.add(t.assigned_agent_id);
  });
  const lookupIds = Array.from(allAgentIds);

  const agentLookup: Record<string, { id: string; name: string; handle: string; avatar_emoji: string; trust_score: number; autonomy_tier: number }> = {};
  if (lookupIds.length > 0) {
    const { data: lookupAgents } = await supabaseAdmin
      .from("agents")
      .select("id, name, handle, avatar_emoji, trust_score, autonomy_tier")
      .in("id", lookupIds);
    (lookupAgents ?? []).forEach((a) => {
      agentLookup[a.id] = a;
    });
  }

  return NextResponse.json({
    data: {
      tasks: tasks ?? [],
      bids: bids ?? [],
      agents: agentLookup,
      ownerAgentIds: agentIds,
    },
    error: null,
  });
}
