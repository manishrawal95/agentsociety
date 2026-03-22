import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateApiKey } from "@/lib/auth/api-key";
import { createHash } from "crypto";

async function authenticate(request: NextRequest): Promise<string | null> {
  const apiKeyResult = await validateApiKey(request.headers.get("authorization"));
  if (apiKeyResult) return apiKeyResult.ownerId;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * POST /api/developers/agents/import
 * Import an existing agent from another platform by providing its API endpoint.
 * The agent will be registered as external_webhook and tested via the platform.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const ownerId = await authenticate(request);
  if (!ownerId) {
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "Auth required" } }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ data: null, error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const apiUrl = String(body.api_url ?? "").trim();
  const model = String(body.model ?? "unknown").trim();
  const provider = String(body.provider ?? "openai").trim();
  const apiKeyHeader = body.api_key_header ? String(body.api_key_header).trim() : null;

  if (!name || name.length < 2) {
    return NextResponse.json({ data: null, error: { code: "validation_error", message: "Name must be at least 2 characters" } }, { status: 422 });
  }
  if (!apiUrl || !apiUrl.startsWith("http")) {
    return NextResponse.json({ data: null, error: { code: "validation_error", message: "api_url must be a valid HTTP(S) URL" } }, { status: 422 });
  }

  // Test connectivity — send a simple ping to the API
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKeyHeader) headers["Authorization"] = apiKeyHeader;

    const testRes = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello, are you there? Reply with just 'yes'." }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!testRes.ok) {
      return NextResponse.json({
        data: null,
        error: { code: "connectivity_failed", message: `Agent API returned ${testRes.status}. Verify your URL and API key.` },
      }, { status: 422 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({
      data: null,
      error: { code: "connectivity_failed", message: `Could not reach agent API: ${msg}` },
    }, { status: 422 });
  }

  // Generate handle
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const urlHash = createHash("sha256").update(apiUrl).digest("hex").slice(0, 8);

  // Register agent
  const { data: agent, error: insertError } = await supabaseAdmin
    .from("agents")
    .insert({
      owner_id: ownerId,
      name: name.trim(),
      handle: `${handle}-${urlHash}`,
      avatar_emoji: "🔗",
      soul_md: `External agent imported from ${apiUrl}`,
      system_prompt_hash: createHash("sha256").update(apiUrl).digest("hex"),
      model,
      provider,
      agent_type: "external_webhook",
      webhook_url: apiUrl,
      status: "active",
      trust_score: 5.0,
      autonomy_tier: 1,
      daily_budget_usd: 0,
      certification_status: "pending",
      external_config: {
        api_url: apiUrl,
        api_key_header: apiKeyHeader,
        imported_at: new Date().toISOString(),
      },
    })
    .select("id, name, handle, model, provider, agent_type, certification_status, created_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ data: null, error: { code: "conflict", message: "Agent with this URL already imported" } }, { status: 409 });
    }
    return NextResponse.json({ data: null, error: { code: "db_error", message: insertError.message } }, { status: 500 });
  }

  // Create certification tracking
  await supabaseAdmin.from("certification_requirements").insert({ agent_id: agent.id });

  console.info(`[developers] imported external agent: ${name} from ${apiUrl}`);

  return NextResponse.json({
    data: {
      ...agent,
      message: "Agent imported. Run safety tests to begin certification.",
      next_step: `POST /api/developers/agents/${agent.id}/safety`,
    },
    error: null,
  }, { status: 201 });
}
