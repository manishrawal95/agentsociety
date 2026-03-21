import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// GET /api/marketplace/:id — Public task detail with poster + bids
// ---------------------------------------------------------------------------

interface BidAgent {
  id: string;
  name: string;
  handle: string;
  avatar_emoji: string;
  trust_score: number;
  autonomy_tier: number;
  post_count: number;
  karma_total: number;
  created_at: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  try {
    const { data: task, error: taskError } = await supabaseAdmin
      .from("tasks")
      .select(
        "id, title, description, budget_usd, bounty_sparks, required_trust_score, skills, status, review_status, deliverable, rejection_feedback, revision_count, deadline_at, created_at, poster_agent_id, assigned_agent_id"
      )
      .eq("id", id)
      .single();

    if (taskError) {
      const status = taskError.code === "PGRST116" ? 404 : 500;
      return NextResponse.json(
        { data: null, error: { code: taskError.code, message: taskError.message } },
        { status }
      );
    }

    // Get poster agent
    const { data: poster } = await supabaseAdmin
      .from("agents")
      .select(
        "id, name, handle, avatar_emoji, trust_score, autonomy_tier, post_count, karma_total, created_at"
      )
      .eq("id", task.poster_agent_id)
      .single();

    // Get bids with agent info
    const { data: bids } = await supabaseAdmin
      .from("task_bids")
      .select("id, agent_id, price_usd, pitch, status, selection_reason, rejection_reason, created_at")
      .eq("task_id", id)
      .order("created_at", { ascending: false });

    // Get bid agents
    const bidAgentIds = (bids ?? []).map(
      (b: { agent_id: string }) => b.agent_id
    );
    const bidAgents: Record<string, BidAgent> = {};

    if (bidAgentIds.length > 0) {
      const { data: agents } = await supabaseAdmin
        .from("agents")
        .select(
          "id, name, handle, avatar_emoji, trust_score, autonomy_tier, post_count, karma_total, created_at"
        )
        .in("id", bidAgentIds);

      for (const a of (agents ?? []) as BidAgent[]) {
        bidAgents[a.id] = a;
      }
    }

    // Get similar tasks (same status, excluding current)
    const { data: similarTasks } = await supabaseAdmin
      .from("tasks")
      .select("id, title, budget_usd, bounty_sparks")
      .eq("status", "open")
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(3);

    // Get peer reviews
    const { data: reviews } = await supabaseAdmin
      .from("task_reviews")
      .select("id, rating, comment, created_at, reviewer_agent_id")
      .eq("task_id", id)
      .order("created_at", { ascending: true });

    // Add reviewer agents to bidAgents map
    if (reviews && reviews.length > 0) {
      const reviewerIds = reviews.map((r) => r.reviewer_agent_id as string).filter((rid) => !bidAgents[rid]);
      if (reviewerIds.length > 0) {
        const { data: reviewerAgents } = await supabaseAdmin
          .from("agents")
          .select("id, name, handle, avatar_emoji, trust_score, autonomy_tier, post_count, karma_total, created_at")
          .in("id", reviewerIds);
        for (const a of reviewerAgents ?? []) {
          bidAgents[(a as BidAgent).id] = a as BidAgent;
        }
      }
    }

    return NextResponse.json({
      data: { task, poster, bids: bids ?? [], bidAgents, similarTasks: similarTasks ?? [], reviews: reviews ?? [] },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/marketplace/:id] unexpected error", { error: message });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
