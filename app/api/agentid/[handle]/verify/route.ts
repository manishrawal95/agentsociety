import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AgentIDCredential } from "@/lib/agentid/types";

const HEADERS = { "X-AgentID-Version": "1.0" };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
): Promise<NextResponse> {
  const { handle } = await params;
  const hash = request.nextUrl.searchParams.get("hash");

  if (!hash) {
    return NextResponse.json(
      { valid: false, reason: "missing_hash" },
      { status: 400, headers: HEADERS }
    );
  }

  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id, status")
    .eq("handle", handle)
    .single();

  if (!agent) {
    return NextResponse.json({ valid: false, reason: "agent_not_found" }, { status: 200, headers: HEADERS });
  }

  if ((agent.status as string) === "suspended") {
    void supabaseAdmin.from("agentid_verifications").insert({
      agent_id: agent.id, queried_by: request.headers.get("x-forwarded-for") ?? "unknown",
      query_type: "verify_hash", result: "agent_suspended",
    });
    return NextResponse.json({ valid: false, reason: "agent_suspended" }, { status: 200, headers: HEADERS });
  }

  const { data: credRow } = await supabaseAdmin
    .from("agentid_credentials")
    .select("credential, credential_hash, expires_at")
    .eq("agent_id", agent.id)
    .eq("is_current", true)
    .single();

  if (!credRow) {
    return NextResponse.json({ valid: false, reason: "no_credential" }, { status: 200, headers: HEADERS });
  }

  const expired = new Date(credRow.expires_at as string).getTime() < Date.now();
  if (expired) {
    void supabaseAdmin.from("agentid_verifications").insert({
      agent_id: agent.id, queried_by: request.headers.get("x-forwarded-for") ?? "unknown",
      query_type: "verify_hash", result: "expired",
    });
    return NextResponse.json({ valid: false, reason: "expired" }, { status: 200, headers: HEADERS });
  }

  if (credRow.credential_hash !== hash) {
    void supabaseAdmin.from("agentid_verifications").insert({
      agent_id: agent.id, queried_by: request.headers.get("x-forwarded-for") ?? "unknown",
      query_type: "verify_hash", result: "hash_mismatch",
    });
    return NextResponse.json({ valid: false, reason: "hash_mismatch" }, { status: 200, headers: HEADERS });
  }

  void supabaseAdmin.from("agentid_verifications").insert({
    agent_id: agent.id, queried_by: request.headers.get("x-forwarded-for") ?? "unknown",
    query_type: "verify_hash", result: "found",
  });

  return NextResponse.json(
    { valid: true, credential: credRow.credential as AgentIDCredential },
    { headers: HEADERS }
  );
}
