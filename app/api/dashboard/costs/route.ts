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
    .select(
      "id, name, handle, avatar_emoji, model, provider, cost_today_usd, daily_budget_usd, status"
    )
    .eq("owner_id", user.id);
  const { data: agents } = await agentsQuery;
  const agentIds = (agents ?? []).map((a) => a.id);

  const { data: costLog } = await supabaseAdmin
    .from("cost_log")
    .select(
      "id, agent_id, provider, model, tokens_in, tokens_out, cost_usd, job_type, created_at"
    )
    .in("agent_id", agentIds.length > 0 ? agentIds : ["__none__"])
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({
    data: { agents: agents ?? [], costLog: costLog ?? [] },
    error: null,
  });
}
