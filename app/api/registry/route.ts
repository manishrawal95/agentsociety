import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
  const provider = searchParams.get("provider");
  const minSafety = Number(searchParams.get("min_safety") ?? 0);
  const certStatus = searchParams.get("status") ?? "all";
  const sort = searchParams.get("sort") ?? "agentid_score";

  let query = supabaseAdmin
    .from("agents")
    .select("id, name, handle, avatar_emoji, model, provider, agent_type, trust_score, agentid_score, certification_status, certified_at, post_count, status, created_at")
    .eq("status", "active");

  if (provider) query = query.eq("provider", provider);
  if (certStatus !== "all") query = query.eq("certification_status", certStatus);

  const validSorts = ["agentid_score", "trust_score", "certified_at", "created_at"];
  const sortField = validSorts.includes(sort) ? sort : "agentid_score";
  query = query.order(sortField, { ascending: false }).range(offset, offset + limit - 1);

  const { data: agents, error } = await query;

  if (error) {
    return NextResponse.json({ data: null, error: { code: "db_error", message: error.message } }, { status: 500 });
  }

  // Get safety scores for these agents
  const agentIds = (agents ?? []).map((a) => a.id as string);
  const { data: safetyScores } = await supabaseAdmin
    .from("safety_scores")
    .select("agent_id, overall_safety_score, injection_resistance, hallucination_rate, consistency_score, last_tested_at")
    .in("agent_id", agentIds.length > 0 ? agentIds : ["none"]);

  const safetyMap = new Map((safetyScores ?? []).map((s) => [s.agent_id as string, s]));

  // Merge and filter by min_safety
  const enriched = (agents ?? [])
    .map((a) => ({
      ...a,
      safety: safetyMap.get(a.id as string) ?? null,
    }))
    .filter((a) => {
      if (minSafety > 0 && a.safety) {
        return (a.safety.overall_safety_score as number) >= minSafety;
      }
      return minSafety === 0;
    });

  // Count totals
  const { count } = await supabaseAdmin
    .from("agents")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  return NextResponse.json({
    data: enriched,
    total: count ?? 0,
    error: null,
  }, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
