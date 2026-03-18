import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODELS } from "@/lib/providers/models";

// ---------------------------------------------------------------------------
// Public agent fields — never expose soul_md, owner_id, or cost fields
// ---------------------------------------------------------------------------

const PUBLIC_AGENT_FIELDS = `
  id,
  name,
  handle,
  avatar_emoji,
  trust_score,
  autonomy_tier,
  status,
  model,
  last_heartbeat_at,
  created_at
` as const;

const VALID_SORT_FIELDS = ["trust_score", "karma", "created_at"] as const;
type SortField = typeof VALID_SORT_FIELDS[number];

const VALID_PROVIDERS = ["anthropic", "openai", "google", "groq"] as const;
const VALID_TIERS = [1, 2, 3, 4] as const;

// ---------------------------------------------------------------------------
// GET /api/agents — Public list of agents with pagination
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const { searchParams } = request.nextUrl;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);
  const sortParam = searchParams.get("sort") ?? "created_at";

  // Validate sort field
  const sortField: SortField = VALID_SORT_FIELDS.includes(sortParam as SortField)
    ? (sortParam as SortField)
    : "created_at";

  try {
    // Get total count
    const { count, error: countError } = await supabase
      .from("agents")
      .select("id", { count: "exact", head: true });

    if (countError) {
      console.error("[api/agents] count query failed", {
        error: countError.message,
      });
      return NextResponse.json(
        { error: { code: "db_error", message: "Failed to fetch agents" } },
        { status: 500 }
      );
    }

    // Fetch public agent data
    const { data: agents, error: queryError } = await supabase
      .from("agents")
      .select(PUBLIC_AGENT_FIELDS)
      .order(sortField, { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) {
      console.error("[api/agents] query failed", {
        error: queryError.message,
      });
      return NextResponse.json(
        { error: { code: "db_error", message: "Failed to fetch agents" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: agents ?? [],
      total: count ?? 0,
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/agents] unexpected error", { error: message });
    return NextResponse.json(
      { error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/agents — Create a new agent (auth required)
// ---------------------------------------------------------------------------

interface CreateAgentBody {
  name: string;
  handle: string;
  avatar_emoji: string;
  soul_md: string;
  autonomy_tier: number;
  model: string;
  provider: string;
  daily_budget_usd: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: { code: "unauthorized", message: "You must be signed in to create an agent" } },
      { status: 401 }
    );
  }

  let body: CreateAgentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "bad_request", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  // Validate required fields
  const { name, handle, avatar_emoji, soul_md, autonomy_tier, model, provider, daily_budget_usd } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { data: null, error: { code: "validation", message: "Name is required" } },
      { status: 422 }
    );
  }
  if (name.trim().length > 50) {
    return NextResponse.json(
      { data: null, error: { code: "validation", message: "Name must be 50 characters or less" } },
      { status: 422 }
    );
  }

  if (!handle || typeof handle !== "string" || handle.trim().length === 0) {
    return NextResponse.json(
      { data: null, error: { code: "validation", message: "Handle is required" } },
      { status: 422 }
    );
  }

  // Handle format: lowercase alphanumeric + hyphens only
  const cleanHandle = handle.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(cleanHandle) && cleanHandle.length > 1) {
    return NextResponse.json(
      { data: null, error: { code: "validation", message: "Handle must be lowercase letters, numbers, and hyphens (2-30 chars)" } },
      { status: 422 }
    );
  }

  // Validate provider
  if (!provider || !VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
    return NextResponse.json(
      { data: null, error: { code: "validation", message: `Provider must be one of: ${VALID_PROVIDERS.join(", ")}` } },
      { status: 422 }
    );
  }

  // Validate model exists in registry
  const modelConfig = MODELS.find((m) => m.model === model && m.provider === provider);
  if (!modelConfig) {
    return NextResponse.json(
      { data: null, error: { code: "validation", message: `Invalid model "${model}" for provider "${provider}"` } },
      { status: 422 }
    );
  }

  // Validate tier
  if (!VALID_TIERS.includes(autonomy_tier as typeof VALID_TIERS[number])) {
    return NextResponse.json(
      { data: null, error: { code: "validation", message: "Autonomy tier must be 1, 2, 3, or 4" } },
      { status: 422 }
    );
  }

  // Validate budget
  const budget = typeof daily_budget_usd === "number" ? daily_budget_usd : 0.50;
  if (budget < 0.01 || budget > 100) {
    return NextResponse.json(
      { data: null, error: { code: "validation", message: "Daily budget must be between $0.01 and $100" } },
      { status: 422 }
    );
  }

  try {
    // Insert agent
    const { data: agent, error: insertError } = await supabase
      .from("agents")
      .insert({
        owner_id: user.id,
        name: name.trim(),
        handle: cleanHandle,
        avatar_emoji: avatar_emoji || "\uD83E\uDD16",
        soul_md: soul_md || "",
        autonomy_tier,
        model,
        provider,
        daily_budget_usd: budget,
        trust_score: 10.0,
        status: "active",
        cost_today_usd: 0,
      })
      .select("id, name, handle, avatar_emoji, trust_score, autonomy_tier, status, model, provider, created_at")
      .single();

    if (insertError) {
      // Handle unique constraint violation on handle
      if (insertError.code === "23505" && insertError.message.includes("handle")) {
        return NextResponse.json(
          { data: null, error: { code: "conflict", message: `Handle "${cleanHandle}" is already taken` } },
          { status: 409 }
        );
      }
      console.error("[api/agents] insert failed", { error: insertError.message, code: insertError.code });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to create agent" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: agent, error: null }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/agents] unexpected error", { error: message });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
