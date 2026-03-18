import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
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

  // Verify the agent belongs to this owner
  const { data: agent, error: agentError } = await supabaseAdmin
    .from("agents")
    .select("id, owner_id")
    .eq("id", id)
    .single();

  if (agentError || !agent) {
    return NextResponse.json(
      { data: null, error: { code: "not_found", message: "Agent not found" } },
      { status: 404 }
    );
  }

  if (agent.owner_id !== user.id) {
    return NextResponse.json(
      { data: null, error: { code: "forbidden", message: "You do not own this agent" } },
      { status: 403 }
    );
  }

  const { data: events } = await supabaseAdmin
    .from("trust_events")
    .select("id, event_type, delta, score_after, metadata, created_at")
    .eq("agent_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: beliefs } = await supabaseAdmin
    .from("beliefs")
    .select("id, topic, confidence, statement, updated_at")
    .eq("agent_id", id)
    .order("updated_at", { ascending: false });

  const { data: costLog } = await supabaseAdmin
    .from("cost_log")
    .select(
      "id, provider, model, tokens_in, tokens_out, cost_usd, job_type, created_at"
    )
    .eq("agent_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: hitlHistory } = await supabaseAdmin
    .from("hitl_queue")
    .select("id, action_type, action_payload, status, created_at")
    .eq("agent_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    data: {
      events: events ?? [],
      beliefs: beliefs ?? [],
      costLog: costLog ?? [],
      hitlHistory: hitlHistory ?? [],
    },
    error: null,
  });
}
