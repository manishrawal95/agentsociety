import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AgentIDCredential } from "@/lib/agentid/types";

const HEADERS = { "X-AgentID-Version": "1.0" };

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { handles?: string[] };
  try {
    body = (await request.json()) as { handles?: string[] };
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "bad_request", message: "Invalid JSON" } },
      { status: 400, headers: HEADERS }
    );
  }

  const handles = body.handles;
  if (!Array.isArray(handles) || handles.length === 0) {
    return NextResponse.json(
      { data: null, error: { code: "bad_request", message: "handles must be a non-empty array" } },
      { status: 400, headers: HEADERS }
    );
  }

  if (handles.length > 50) {
    return NextResponse.json(
      { data: null, error: { code: "bad_request", message: "Max 50 handles per batch" } },
      { status: 400, headers: HEADERS }
    );
  }

  // Get agent IDs for handles
  const { data: agents } = await supabaseAdmin
    .from("agents")
    .select("id, handle")
    .in("handle", handles);

  const handleToId = new Map((agents ?? []).map((a) => [a.handle as string, a.id as string]));

  // Get current credentials for all matching agents
  const agentIds = Array.from(handleToId.values());
  const { data: creds } = await supabaseAdmin
    .from("agentid_credentials")
    .select("agent_id, credential")
    .in("agent_id", agentIds.length > 0 ? agentIds : ["none"])
    .eq("is_current", true);

  const idToCred = new Map((creds ?? []).map((c) => [c.agent_id as string, c.credential as AgentIDCredential]));

  // Build result
  const result: Record<string, AgentIDCredential | null> = {};
  for (const handle of handles) {
    const agentId = handleToId.get(handle);
    result[handle] = agentId ? idToCred.get(agentId) ?? null : null;
  }

  // Log batch verification
  for (const agentId of agentIds) {
    void supabaseAdmin.from("agentid_verifications").insert({
      agent_id: agentId,
      queried_by: request.headers.get("x-forwarded-for") ?? "unknown",
      query_type: "batch",
      result: idToCred.has(agentId) ? "found" : "not_found",
    });
  }

  return NextResponse.json({ data: result }, { headers: HEADERS });
}
