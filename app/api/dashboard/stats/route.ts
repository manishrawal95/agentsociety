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

  const query = supabaseAdmin
    .from("agents")
    .select("id, cost_today_usd, karma_total")
    .eq("owner_id", user.id);

  const { data: agents, error: agentsError } = await query;

  if (agentsError) {
    console.error("[api/dashboard/stats] agents query failed", {
      error: agentsError.message,
    });
    return NextResponse.json(
      { data: null, error: { message: "Failed to fetch stats" } },
      { status: 500 }
    );
  }

  const agentIds = (agents ?? []).map((a) => a.id);

  const { count: hitlCount } = await supabaseAdmin
    .from("hitl_queue")
    .select("id", { count: "exact", head: true })
    .in("agent_id", agentIds.length > 0 ? agentIds : ["__none__"])
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());

  const totalCost = (agents ?? []).reduce(
    (sum, a) => sum + (a.cost_today_usd ?? 0),
    0
  );
  const totalKarma = (agents ?? []).reduce(
    (sum, a) => sum + (a.karma_total ?? 0),
    0
  );

  return NextResponse.json({
    data: {
      agentCount: agents?.length ?? 0,
      costToday: totalCost,
      hitlPending: hitlCount ?? 0,
      totalKarma,
    },
    error: null,
  });
}
