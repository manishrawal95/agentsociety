import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateApiKey } from "@/lib/auth/api-key";
import { checkRateLimit } from "@/lib/api-utils";
import { evaluateInteraction, calculateRunningScores } from "@/lib/safety/monitor";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // Auth via API key only (this is a machine-to-machine endpoint)
  const apiKeyResult = await validateApiKey(request.headers.get("authorization"));
  if (!apiKeyResult) {
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "API key required" } }, { status: 401 });
  }

  // Rate limit: 1000 logs/hour per agent
  const { allowed } = checkRateLimit(`monitor:${id}`, 1000, 3600000);
  if (!allowed) {
    return NextResponse.json({ data: null, error: { code: "rate_limited", message: "Max 1000 interactions/hour" } }, { status: 429 });
  }

  // Verify ownership
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("id", id)
    .eq("owner_id", apiKeyResult.ownerId)
    .single();

  if (!agent) {
    return NextResponse.json({ data: null, error: { code: "not_found", message: "Agent not found" } }, { status: 404 });
  }

  // Parse body
  let body: { prompt?: string; response?: string };
  try {
    body = (await request.json()) as { prompt?: string; response?: string };
  } catch {
    return NextResponse.json({ data: null, error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }

  const prompt = String(body.prompt ?? "").trim();
  const response = String(body.response ?? "").trim();

  if (!prompt || !response) {
    return NextResponse.json({ data: null, error: { code: "validation_error", message: "prompt and response are required" } }, { status: 422 });
  }

  // Evaluate interaction
  const evaluation = evaluateInteraction(prompt, response);

  // Store log (cap at 1000 per agent — delete oldest)
  const { count } = await supabaseAdmin
    .from("agent_interaction_logs")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", id);

  if (count !== null && count >= 1000) {
    // Delete oldest logs to stay under cap
    const excess = count - 999;
    const { data: oldLogs } = await supabaseAdmin
      .from("agent_interaction_logs")
      .select("id")
      .eq("agent_id", id)
      .order("created_at", { ascending: true })
      .limit(excess);

    if (oldLogs && oldLogs.length > 0) {
      await supabaseAdmin
        .from("agent_interaction_logs")
        .delete()
        .in("id", oldLogs.map((l) => (l as { id: string }).id));
    }
  }

  // Insert new log
  await supabaseAdmin.from("agent_interaction_logs").insert({
    agent_id: id,
    prompt: prompt.slice(0, 2000),
    response: response.slice(0, 5000),
    injection_flagged: evaluation.injection_flagged,
    hallucination_flagged: evaluation.hallucination_flagged,
    score: evaluation.score,
  });

  // Update running safety scores if significant change
  const { data: recentLogs } = await supabaseAdmin
    .from("agent_interaction_logs")
    .select("injection_flagged, hallucination_flagged, score")
    .eq("agent_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (recentLogs && recentLogs.length >= 10) {
    const running = calculateRunningScores(
      recentLogs as { injection_flagged: boolean; hallucination_flagged: boolean; score: number }[]
    );

    // Update safety_scores with monitoring data (blend with test scores)
    const { data: existing } = await supabaseAdmin
      .from("safety_scores")
      .select("injection_resistance, hallucination_rate, overall_safety_score")
      .eq("agent_id", id)
      .single();

    if (existing) {
      // Blend: 60% test scores + 40% monitoring scores
      const blended_injection = Math.round(
        (existing.injection_resistance as number) * 0.6 + running.injection_resistance * 0.4
      );
      const blended_hallucination = Math.round(
        (existing.hallucination_rate as number) * 0.6 + running.hallucination_rate * 0.4
      );
      const blended_overall = Math.round(
        (existing.overall_safety_score as number) * 0.6 + running.overall * 0.4
      );

      await supabaseAdmin
        .from("safety_scores")
        .update({
          injection_resistance: blended_injection,
          hallucination_rate: blended_hallucination,
          overall_safety_score: blended_overall,
          updated_at: new Date().toISOString(),
        })
        .eq("agent_id", id);
    }
  }

  return NextResponse.json({
    data: {
      evaluation,
      total_logs: (count ?? 0) + 1,
    },
    error: null,
  });
}

// GET: View monitoring stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const apiKeyResult = await validateApiKey(request.headers.get("authorization"));
  if (!apiKeyResult) {
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "API key required" } }, { status: 401 });
  }

  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("id", id)
    .eq("owner_id", apiKeyResult.ownerId)
    .single();

  if (!agent) {
    return NextResponse.json({ data: null, error: { code: "not_found", message: "Agent not found" } }, { status: 404 });
  }

  const { count } = await supabaseAdmin
    .from("agent_interaction_logs")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", id);

  const { data: recentLogs } = await supabaseAdmin
    .from("agent_interaction_logs")
    .select("injection_flagged, hallucination_flagged, score, created_at")
    .eq("agent_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const flaggedCount = (recentLogs ?? []).filter(
    (l) => (l as { injection_flagged: boolean }).injection_flagged || (l as { hallucination_flagged: boolean }).hallucination_flagged
  ).length;

  const running = calculateRunningScores(
    (recentLogs ?? []) as { injection_flagged: boolean; hallucination_flagged: boolean; score: number }[]
  );

  return NextResponse.json({
    data: {
      total_logs: count ?? 0,
      recent_flagged: flaggedCount,
      running_scores: running,
      last_log_at: recentLogs && recentLogs.length > 0 ? (recentLogs[0] as { created_at: string }).created_at : null,
    },
    error: null,
  });
}
