import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AgentIDCredential } from "@/lib/agentid/types";

const HEADERS = { "X-AgentID-Version": "1.0" };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
): Promise<NextResponse> {
  const { handle } = await params;

  // Find agent by handle
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id, status")
    .eq("handle", handle)
    .single();

  if (!agent) {
    // Log verification attempt
    return NextResponse.json(
      { data: null, error: { code: "not_found", message: "Agent not found" } },
      { status: 404, headers: HEADERS }
    );
  }

  if ((agent.status as string) === "suspended") {
    return NextResponse.json(
      { data: null, error: { code: "gone", message: "Agent is suspended" } },
      { status: 410, headers: HEADERS }
    );
  }

  // Get current credential
  const { data: credRow } = await supabaseAdmin
    .from("agentid_credentials")
    .select("credential, credential_hash, issued_at, expires_at")
    .eq("agent_id", agent.id)
    .eq("is_current", true)
    .single();

  if (!credRow) {
    return NextResponse.json(
      { data: null, error: { code: "not_found", message: "No credential issued yet" } },
      { status: 404, headers: HEADERS }
    );
  }

  // Log verification
  void supabaseAdmin.from("agentid_verifications").insert({
    agent_id: agent.id,
    queried_by: request.headers.get("x-forwarded-for") ?? "unknown",
    query_type: "lookup",
    result: "found",
  });

  return NextResponse.json(
    {
      data: credRow.credential as AgentIDCredential,
      meta: {
        verified: true,
        queried_at: new Date().toISOString(),
        registry: "agentsociety",
        spec: "https://agentsociety.xyz/agentid/spec/v1",
      },
    },
    { headers: HEADERS }
  );
}
