import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateApiKey } from "@/lib/auth/api-key";
import { createHash } from "crypto";

/**
 * Authenticate via session OR API key. Returns owner_id or null.
 */
async function authenticate(request: NextRequest): Promise<string | null> {
  // Try API key first
  const apiKeyResult = await validateApiKey(request.headers.get("authorization"));
  if (apiKeyResult) return apiKeyResult.ownerId;

  // Fall back to session auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ownerId = await authenticate(request);
  if (!ownerId) {
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "API key or session required" } }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("id, name, handle, avatar_emoji, model, provider, agent_type, certification_status, certified_at, trust_score, agentid_score, status, created_at")
    .eq("owner_id", ownerId)
    .in("agent_type", ["external_hosted", "external_webhook"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ data: null, error: { code: "db_error", message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], error: null });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const name = String(body.name ?? "").trim();
  const model = String(body.model ?? "").trim();
  const provider = String(body.provider ?? "").trim();
  const agentType = String(body.agent_type ?? "external_hosted");
  const webhookUrl = body.webhook_url ? String(body.webhook_url).trim() : null;
  const systemPrompt = body.system_prompt ? String(body.system_prompt) : "";
  const avatarEmoji = String(body.avatar_emoji ?? "🤖").trim();

  // Validate
  if (!name || name.length < 2) {
    return NextResponse.json({ data: null, error: { code: "validation_error", message: "Name must be at least 2 characters" } }, { status: 422 });
  }
  if (!model) {
    return NextResponse.json({ data: null, error: { code: "validation_error", message: "Model is required" } }, { status: 422 });
  }
  if (!provider || !["anthropic", "openai", "google", "groq"].includes(provider)) {
    return NextResponse.json({ data: null, error: { code: "validation_error", message: "Provider must be anthropic, openai, google, or groq" } }, { status: 422 });
  }
  if (!["external_hosted", "external_webhook"].includes(agentType)) {
    return NextResponse.json({ data: null, error: { code: "validation_error", message: "agent_type must be external_hosted or external_webhook" } }, { status: 422 });
  }
  if (agentType === "external_webhook" && !webhookUrl) {
    return NextResponse.json({ data: null, error: { code: "validation_error", message: "webhook_url required for external_webhook agents" } }, { status: 422 });
  }

  // Generate handle from name
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (handle.length < 2) {
    return NextResponse.json({ data: null, error: { code: "validation_error", message: "Name must produce a valid handle" } }, { status: 422 });
  }

  // Hash system prompt
  const systemPromptHash = systemPrompt
    ? createHash("sha256").update(systemPrompt).digest("hex")
    : null;

  // Insert agent
  const { data: agent, error: insertError } = await supabaseAdmin
    .from("agents")
    .insert({
      owner_id: ownerId,
      name: name.trim(),
      handle,
      avatar_emoji: avatarEmoji,
      soul_md: systemPrompt,
      system_prompt_hash: systemPromptHash,
      model,
      provider,
      agent_type: agentType,
      webhook_url: webhookUrl,
      status: "active",
      trust_score: 10.0,
      autonomy_tier: 1,
      daily_budget_usd: 1.0,
      certification_status: "pending",
    })
    .select("id, name, handle, model, provider, agent_type, certification_status, created_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ data: null, error: { code: "conflict", message: "An agent with this handle already exists" } }, { status: 409 });
    }
    return NextResponse.json({ data: null, error: { code: "db_error", message: insertError.message } }, { status: 500 });
  }

  // Create certification tracking row
  const { error: certError } = await supabaseAdmin.from("certification_requirements").insert({ agent_id: agent.id });
  if (certError) {
    console.error(`[developers] cert tracking insert failed for agent=${agent.id}:`, certError.message);
  }

  console.info(`[developers] registered external agent: ${name} (@${handle}) type=${agentType} owner=${ownerId}`);

  return NextResponse.json({ data: agent, error: null }, { status: 201 });
}
