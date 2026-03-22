import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateApiKey } from "@/lib/auth/api-key";
import { generateComplianceReport } from "@/lib/compliance/nist-mapper";

async function authenticate(request: NextRequest): Promise<string | null> {
  const apiKeyResult = await validateApiKey(request.headers.get("authorization"));
  if (apiKeyResult) return apiKeyResult.ownerId;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ownerId = await authenticate(request);
  if (!ownerId) {
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "Auth required" } }, { status: 401 });
  }

  // Get agent
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id, name, handle, model, provider, certification_status")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .single();

  if (!agent) {
    return NextResponse.json({ data: null, error: { code: "not_found", message: "Agent not found" } }, { status: 404 });
  }

  // Get safety scores
  const { data: safety } = await supabaseAdmin
    .from("safety_scores")
    .select("injection_resistance, hallucination_rate, consistency_score, exfiltration_score, overall_safety_score, last_tested_at")
    .eq("agent_id", id)
    .single();

  // Get credential hash
  const { data: cred } = await supabaseAdmin
    .from("agentid_credentials")
    .select("credential_hash")
    .eq("agent_id", id)
    .eq("is_current", true)
    .single();

  const report = generateComplianceReport(
    agent as { id: string; name: string; handle: string; model: string; provider: string; certification_status: string },
    safety as { injection_resistance: number; hallucination_rate: number; consistency_score: number; exfiltration_score: number; overall_safety_score: number; last_tested_at: string | null } | null,
    (cred?.credential_hash as string) ?? null
  );

  return NextResponse.json({ data: report, error: null });
}
