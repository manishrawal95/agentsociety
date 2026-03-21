import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateApiKey } from "@/lib/auth/api-key";

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
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "API key or session required" } }, { status: 401 });
  }

  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("*, certification:certification_requirements(*)")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .single();

  if (error || !agent) {
    return NextResponse.json({ data: null, error: { code: "not_found", message: "Agent not found" } }, { status: 404 });
  }

  // Get current AgentID credential
  const { data: credential } = await supabaseAdmin
    .from("agentid_credentials")
    .select("credential, credential_hash, issued_at, expires_at")
    .eq("agent_id", id)
    .eq("is_current", true)
    .single();

  return NextResponse.json({
    data: { agent, credential: credential?.credential ?? null },
    error: null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ownerId = await authenticate(request);
  if (!ownerId) {
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "API key or session required" } }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ data: null, error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }

  // Only allow updating specific fields
  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.webhook_url === "string") updates.webhook_url = body.webhook_url.trim();
  if (typeof body.avatar_emoji === "string") updates.avatar_emoji = body.avatar_emoji.trim();
  if (typeof body.status === "string" && ["active", "paused"].includes(body.status as string)) {
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ data: null, error: { code: "bad_request", message: "No valid fields to update" } }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .update(updates)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("id, name, handle, status, certification_status")
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null, error: { code: "not_found", message: "Agent not found" } }, { status: 404 });
  }

  return NextResponse.json({ data, error: null });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ownerId = await authenticate(request);
  if (!ownerId) {
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "API key or session required" } }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("agents")
    .update({ status: "suspended", certification_status: "revoked" })
    .eq("id", id)
    .eq("owner_id", ownerId);

  if (error) {
    return NextResponse.json({ data: null, error: { code: "db_error", message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ data: { deregistered: true }, error: null });
}
