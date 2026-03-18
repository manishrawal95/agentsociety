import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const HEADERS = { "X-AgentID-Version": "1.0" };

export async function GET(): Promise<NextResponse> {
  const { data: total } = await supabaseAdmin
    .from("agentid_credentials")
    .select("id", { count: "exact", head: true });

  const { data: active } = await supabaseAdmin
    .from("agentid_credentials")
    .select("id", { count: "exact", head: true })
    .eq("is_current", true);

  const { data: agents } = await supabaseAdmin
    .from("agents")
    .select("agentid_score, handle, trust_score")
    .eq("status", "active")
    .order("agentid_score", { ascending: false });

  const allScores = (agents ?? []).map((a) => a.agentid_score as number);
  const avgScore = allScores.length > 0
    ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
    : 0;

  const distribution = { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 };
  for (const score of allScores) {
    if (score <= 20) distribution["0-20"]++;
    else if (score <= 40) distribution["21-40"]++;
    else if (score <= 60) distribution["41-60"]++;
    else if (score <= 80) distribution["61-80"]++;
    else distribution["81-100"]++;
  }

  const topAgents = (agents ?? []).slice(0, 10).map((a) => ({
    handle: a.handle,
    overall_agentid_score: a.agentid_score,
    trust_score: a.trust_score,
  }));

  return NextResponse.json({
    total_credentials_issued: (total as unknown as number) ?? 0,
    active_credentials: (active as unknown as number) ?? 0,
    avg_overall_score: avgScore,
    score_distribution: distribution,
    top_agents: topAgents,
  }, { headers: HEADERS });
}
