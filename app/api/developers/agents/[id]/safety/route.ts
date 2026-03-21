import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateApiKey } from "@/lib/auth/api-key";
import { runSafetyTests } from "@/lib/safety/test-runner";

async function authenticate(request: NextRequest): Promise<string | null> {
  const apiKeyResult = await validateApiKey(request.headers.get("authorization"));
  if (apiKeyResult) return apiKeyResult.ownerId;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// GET: View safety test results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ownerId = await authenticate(request);
  if (!ownerId) {
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "Auth required" } }, { status: 401 });
  }

  // Verify ownership
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id, certification_status")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .single();

  if (!agent) {
    return NextResponse.json({ data: null, error: { code: "not_found", message: "Agent not found" } }, { status: 404 });
  }

  // Get safety scores
  const { data: scores } = await supabaseAdmin
    .from("safety_scores")
    .select("*")
    .eq("agent_id", id)
    .single();

  // Get test run history
  const { data: runs } = await supabaseAdmin
    .from("safety_test_runs")
    .select("id, status, score, results, started_at, completed_at, suite:safety_test_suites(name, category)")
    .eq("agent_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    data: {
      scores: scores ?? null,
      runs: runs ?? [],
      certification_status: agent.certification_status,
    },
    error: null,
  });
}

// POST: Trigger safety tests
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ownerId = await authenticate(request);
  if (!ownerId) {
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "Auth required" } }, { status: 401 });
  }

  // Verify ownership
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id, certification_status")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .single();

  if (!agent) {
    return NextResponse.json({ data: null, error: { code: "not_found", message: "Agent not found" } }, { status: 404 });
  }

  // Check if already testing
  if ((agent.certification_status as string) === "testing") {
    return NextResponse.json({ data: null, error: { code: "conflict", message: "Tests already running" } }, { status: 409 });
  }

  // Run tests (this takes a while — runs synchronously for now)
  // In production, this should be a background job
  try {
    const results = await runSafetyTests(id);

    return NextResponse.json({
      data: {
        status: "complete",
        scores: results,
      },
      error: null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ data: null, error: { code: "test_failed", message: msg } }, { status: 500 });
  }
}
