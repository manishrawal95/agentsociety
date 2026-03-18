import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_STATUSES = ["active", "paused", "suspended"] as const;
const MIN_TIER = 1;
const MAX_TIER = 4;

interface AgentPatchFields {
  name?: string;
  soul_md?: string;
  autonomy_tier?: number;
  daily_budget_usd?: number;
  heartbeat_interval_min?: number;
  status?: string;
}

function validatePatchBody(body: Record<string, unknown>): {
  valid: boolean;
  fields: AgentPatchFields;
  error: string | null;
} {
  const fields: AgentPatchFields = {};

  // Reject immutable field changes
  if ("handle" in body) {
    return { valid: false, fields, error: "Handle is immutable and cannot be changed" };
  }

  if ("owner_id" in body) {
    return { valid: false, fields, error: "Owner cannot be changed" };
  }

  if ("id" in body) {
    return { valid: false, fields, error: "ID cannot be changed" };
  }

  // Validate individual fields
  if ("name" in body) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return { valid: false, fields, error: "Name must be a non-empty string" };
    }
    fields.name = body.name.trim();
  }

  if ("soul_md" in body) {
    if (typeof body.soul_md !== "string") {
      return { valid: false, fields, error: "soul_md must be a string" };
    }
    fields.soul_md = body.soul_md;
  }

  if ("autonomy_tier" in body) {
    const tier = Number(body.autonomy_tier);
    if (!Number.isInteger(tier) || tier < MIN_TIER || tier > MAX_TIER) {
      return {
        valid: false,
        fields,
        error: `autonomy_tier must be an integer between ${MIN_TIER} and ${MAX_TIER}`,
      };
    }
    fields.autonomy_tier = tier;
  }

  if ("daily_budget_usd" in body) {
    const budget = Number(body.daily_budget_usd);
    if (isNaN(budget) || budget <= 0) {
      return {
        valid: false,
        fields,
        error: "daily_budget_usd must be a positive number",
      };
    }
    fields.daily_budget_usd = budget;
  }

  if ("heartbeat_interval_min" in body) {
    const interval = Number(body.heartbeat_interval_min);
    if (!Number.isInteger(interval) || interval < 5 || interval > 360) {
      return {
        valid: false,
        fields,
        error: "heartbeat_interval_min must be an integer between 5 and 360",
      };
    }
    fields.heartbeat_interval_min = interval;
  }

  if ("status" in body) {
    const status = body.status as string;
    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return {
        valid: false,
        fields,
        error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
      };
    }
    fields.status = status;
  }

  if (Object.keys(fields).length === 0) {
    return { valid: false, fields, error: "No valid fields to update" };
  }

  return { valid: true, fields, error: null };
}

// ---------------------------------------------------------------------------
// GET /api/dashboard/agents/[id] — Fetch a single agent (owner-scoped)
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 }
    );
  }

  try {
    const { data: agent, error: queryError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .single();

    if (queryError || !agent) {
      return NextResponse.json(
        { data: null, error: { code: "not_found", message: "Agent not found" } },
        { status: 404 }
      );
    }

    // Owner check
    const agentData = agent as Record<string, unknown>;
    if (agentData.owner_id !== user.id) {
      console.warn("[api/dashboard/agents/[id]] forbidden — not owner", {
        agent_id: id,
        user_id: user.id,
      });
      return NextResponse.json(
        { data: null, error: { code: "forbidden", message: "You do not own this agent" } },
        { status: 403 }
      );
    }

    return NextResponse.json({ data: agent, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/dashboard/agents/[id]] GET error", {
      agent_id: id,
      error: message,
    });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/dashboard/agents/[id] — Update agent fields (owner-scoped)
// ---------------------------------------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 }
    );
  }

  try {
    // Verify ownership first
    const { data: existing, error: fetchError } = await supabase
      .from("agents")
      .select("id, owner_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Agent not found" } },
        { status: 404 }
      );
    }

    const existingData = existing as Record<string, unknown>;
    if (existingData.owner_id !== user.id) {
      console.warn("[api/dashboard/agents/[id]] PATCH forbidden — not owner", {
        agent_id: id,
        user_id: user.id,
      });
      return NextResponse.json(
        { error: { code: "forbidden", message: "You do not own this agent" } },
        { status: 403 }
      );
    }

    // Parse and validate body
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: { code: "bad_request", message: "Invalid JSON body" } },
        { status: 400 }
      );
    }

    const validation = validatePatchBody(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: { code: "validation_error", message: validation.error } },
        { status: 422 }
      );
    }

    // Update
    const { data: updated, error: updateError } = await supabase
      .from("agents")
      .update(validation.fields)
      .eq("id", id)
      .eq("owner_id", user.id) // Double-check ownership in the query
      .select("*")
      .single();

    if (updateError) {
      console.error("[api/dashboard/agents/[id]] PATCH failed", {
        agent_id: id,
        user_id: user.id,
        error: updateError.message,
      });
      return NextResponse.json(
        { error: { code: "db_error", message: "Failed to update agent" } },
        { status: 500 }
      );
    }

    console.info(
      `[api/dashboard/agents/[id]] updated agent_id=${id} fields=${Object.keys(validation.fields).join(",")}`
    );

    return NextResponse.json({ data: updated, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/dashboard/agents/[id]] PATCH error", {
      agent_id: id,
      user_id: user.id,
      error: message,
    });
    return NextResponse.json(
      { error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
