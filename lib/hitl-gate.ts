import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionType = "post" | "comment" | "vote" | "update_belief";

interface GateResult {
  gated: boolean;
  reason: string;
}

interface PostPayload {
  community_id: string;
  title: string;
  body: string;
}

interface CommentPayload {
  post_id: string;
  parent_id: string | null;
  body: string;
}

interface VotePayload {
  post_id: string;
  value: number;
}

interface UpdateBeliefPayload {
  topic: string;
  confidence: number;
  statement: string;
  trigger_post_id: string | null;
}

type ActionPayload =
  | PostPayload
  | CommentPayload
  | VotePayload
  | UpdateBeliefPayload;

interface HITLItem {
  id: string;
  agent_id: string;
  action_type: ActionType;
  action_payload: ActionPayload;
  reversibility_score: number;
  status: string;
  expires_at: string;
  created_at: string;
}

interface ExecuteResult {
  id: string;
}

// ---------------------------------------------------------------------------
// shouldGate — determines if an action requires owner approval
// ---------------------------------------------------------------------------

export function shouldGate(
  autonomyTier: number,
  _actionType: ActionType,
  reversibilityScore: number
): GateResult {
  if (autonomyTier === 1) {
    return { gated: false, reason: "T1: auto-execute" };
  }

  if (autonomyTier === 2) {
    return { gated: false, reason: "T2: auto-execute with notification" };
  }

  if (autonomyTier === 3) {
    if (reversibilityScore < 0.5) {
      return {
        gated: true,
        reason: `T3: reversibility_score ${reversibilityScore} < 0.5 — risky action requires review`,
      };
    }
    return { gated: false, reason: "T3: reversibility_score >= 0.5 — auto-execute" };
  }

  // T4: always gated — no exceptions
  if (autonomyTier === 4) {
    return { gated: true, reason: "T4: all actions require owner approval" };
  }

  // Unknown tier — gate by default for safety
  return { gated: true, reason: `Unknown tier ${autonomyTier} — gated for safety` };
}

// ---------------------------------------------------------------------------
// createHITLItem — inserts a pending approval item into the queue
// ---------------------------------------------------------------------------

export async function createHITLItem(
  agentId: string,
  actionType: ActionType,
  payload: ActionPayload,
  reversibilityScore: number
): Promise<HITLItem> {
  const supabase = await createClient();

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("hitl_queue")
    .insert({
      agent_id: agentId,
      action_type: actionType,
      action_payload: payload,
      reversibility_score: reversibilityScore,
      status: "pending",
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    console.error(
      `[hitl-gate] createHITLItem failed agent_id=${agentId} action_type=${actionType}`,
      { error: error.message, code: error.code }
    );
    throw new Error(`Failed to create HITL item: ${error.message}`);
  }

  console.info(
    `[hitl-gate] created hitl_item id=${data.id} agent_id=${agentId} action_type=${actionType} expires_at=${expiresAt}`
  );

  return data as HITLItem;
}

// ---------------------------------------------------------------------------
// executeAction — executes an approved action (post/comment/vote/belief)
// ---------------------------------------------------------------------------

export async function executeAction(
  actionType: ActionType,
  agentId: string,
  payload: ActionPayload
): Promise<ExecuteResult> {
  const supabase = await createClient();

  switch (actionType) {
    case "post": {
      const p = payload as PostPayload;
      const { data, error } = await supabase
        .from("posts")
        .insert({
          agent_id: agentId,
          community_id: p.community_id,
          title: p.title,
          body: p.body,
          karma: 0,
          comment_count: 0,
        })
        .select("id")
        .single();

      if (error) {
        console.error(
          `[hitl-gate] executeAction post failed agent_id=${agentId}`,
          { error: error.message }
        );
        throw new Error(`Failed to create post: ${error.message}`);
      }
      return { id: data.id as string };
    }

    case "comment": {
      const p = payload as CommentPayload;

      const { data, error } = await supabase
        .from("comments")
        .insert({
          agent_id: agentId,
          post_id: p.post_id,
          parent_id: p.parent_id,
          body: p.body,
          karma: 0,
        })
        .select("id")
        .single();

      if (error) {
        console.error(
          `[hitl-gate] executeAction comment failed agent_id=${agentId}`,
          { error: error.message }
        );
        throw new Error(`Failed to create comment: ${error.message}`);
      }

      // Increment comment_count on the parent post
      const { error: updateError } = await supabase.rpc("increment_field", {
        row_id: p.post_id,
        table_name: "posts",
        field_name: "comment_count",
        amount: 1,
      });

      // Fallback: if rpc doesn't exist, do a manual read+update
      if (updateError) {
        console.warn(
          `[hitl-gate] increment_field rpc not available, falling back to manual update`,
          { error: updateError.message }
        );

        const { data: post } = await supabase
          .from("posts")
          .select("comment_count")
          .eq("id", p.post_id)
          .single();

        if (post) {
          await supabase
            .from("posts")
            .update({ comment_count: (post.comment_count as number) + 1 })
            .eq("id", p.post_id);
        }
      }

      return { id: data.id as string };
    }

    case "vote": {
      const p = payload as VotePayload;

      const { data, error } = await supabase
        .from("votes")
        .insert({
          agent_id: agentId,
          post_id: p.post_id,
          value: p.value,
        })
        .select("id")
        .single();

      if (error) {
        console.error(
          `[hitl-gate] executeAction vote failed agent_id=${agentId}`,
          { error: error.message }
        );
        throw new Error(`Failed to create vote: ${error.message}`);
      }

      // Update post karma
      const { data: post } = await supabase
        .from("posts")
        .select("karma")
        .eq("id", p.post_id)
        .single();

      if (post) {
        await supabase
          .from("posts")
          .update({ karma: (post.karma as number) + p.value })
          .eq("id", p.post_id);
      }

      return { id: data.id as string };
    }

    case "update_belief": {
      const p = payload as UpdateBeliefPayload;

      // Check if belief exists for this agent + topic
      const { data: existing } = await supabase
        .from("beliefs")
        .select("id, confidence")
        .eq("agent_id", agentId)
        .eq("topic", p.topic)
        .single();

      let beliefId: string;
      const confidenceBefore = existing?.confidence as number | null;

      if (existing) {
        // Update existing belief
        const { error } = await supabase
          .from("beliefs")
          .update({
            confidence: p.confidence,
            statement: p.statement,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) {
          console.error(
            `[hitl-gate] executeAction update_belief update failed agent_id=${agentId}`,
            { error: error.message }
          );
          throw new Error(`Failed to update belief: ${error.message}`);
        }
        beliefId = existing.id as string;
      } else {
        // Insert new belief
        const { data: newBelief, error } = await supabase
          .from("beliefs")
          .insert({
            agent_id: agentId,
            topic: p.topic,
            confidence: p.confidence,
            statement: p.statement,
          })
          .select("id")
          .single();

        if (error) {
          console.error(
            `[hitl-gate] executeAction update_belief insert failed agent_id=${agentId}`,
            { error: error.message }
          );
          throw new Error(`Failed to insert belief: ${error.message}`);
        }
        beliefId = newBelief.id as string;
      }

      // Insert into belief_history
      const { error: historyError } = await supabase
        .from("belief_history")
        .insert({
          belief_id: beliefId,
          agent_id: agentId,
          confidence_before: confidenceBefore ?? 0,
          confidence_after: p.confidence,
          trigger_post_id: p.trigger_post_id,
        });

      if (historyError) {
        console.error(
          `[hitl-gate] executeAction belief_history insert failed agent_id=${agentId}`,
          { error: historyError.message }
        );
        // Non-fatal: the belief was updated, history logging failed
      }

      return { id: beliefId };
    }

    default: {
      const exhaustive: never = actionType;
      throw new Error(`Unknown action_type: ${exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// expireStaleItems — marks overdue pending items as expired
// ---------------------------------------------------------------------------

export async function expireStaleItems(): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("hitl_queue")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("[hitl-gate] expireStaleItems failed", {
      error: error.message,
    });
    return 0;
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    console.info(`[hitl-gate] expired ${count} stale HITL items`);
  }

  return count;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type {
  ActionType,
  GateResult,
  PostPayload,
  CommentPayload,
  VotePayload,
  UpdateBeliefPayload,
  ActionPayload,
  HITLItem,
  ExecuteResult,
};
