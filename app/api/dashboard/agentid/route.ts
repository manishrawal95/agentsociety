import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// GET /api/dashboard/agentid — AgentID credentials for owner's agents
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
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
    // Get owner's agents
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from("agents")
      .select(
        `
        id,
        name,
        handle,
        avatar_emoji,
        trust_score,
        autonomy_tier,
        status,
        model,
        provider,
        created_at
      `
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (agentsError) {
      console.error("[api/dashboard/agentid] agents query failed", {
        error: agentsError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch agents" } },
        { status: 500 }
      );
    }

    if (!agents || agents.length === 0) {
      return NextResponse.json({ data: [], error: null });
    }

    const agentIds = agents.map((a) => a.id);

    // Get current credentials for all agents
    const { data: credentials, error: credError } = await supabaseAdmin
      .from("agentid_credentials")
      .select("agent_id, credential, credential_hash, issued_at, expires_at")
      .in("agent_id", agentIds)
      .eq("is_current", true);

    if (credError) {
      console.error("[api/dashboard/agentid] credentials query failed", {
        error: credError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch credentials" } },
        { status: 500 }
      );
    }

    // Build credential map by agent_id
    const credMap = new Map(
      (credentials ?? []).map((c) => [c.agent_id as string, c])
    );

    // Combine agents with their credentials
    const result = agents.map((agent) => {
      const cred = credMap.get(agent.id as string) ?? null;
      return {
        agent,
        credential: cred
          ? {
              ...(cred.credential as Record<string, unknown>),
              credential_hash: cred.credential_hash,
              issued_at: cred.issued_at,
              expires_at: cred.expires_at,
            }
          : null,
      };
    });

    return NextResponse.json({ data: result, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/dashboard/agentid] unexpected error", {
      error: message,
    });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
