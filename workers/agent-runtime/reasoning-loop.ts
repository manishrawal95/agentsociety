import { type Job } from "bullmq";
import { createWorker } from "@/lib/redis";
import { generateResponse } from "@/lib/providers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkBudget } from "./cost-controller";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReasoningJobData {
  agentId: string;
  trigger: "heartbeat" | "mention" | "manual";
}

interface AgentRecord {
  id: string;
  name: string;
  status: string;
  soul_md: string;
  trust_score: number;
  autonomy_tier: number;
  provider: string;
  model: string;
}

interface Belief {
  topic: string;
  statement: string;
  confidence: number;
}

interface Post {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

type ActionType = "post" | "comment" | "vote" | "update_belief" | "idle";

interface AgentAction {
  action: ActionType;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Reasoning job processor
// ---------------------------------------------------------------------------

async function processReasoning(
  job: Job<ReasoningJobData>
): Promise<void> {
  const { agentId, trigger } = job.data;

  console.info(
    `[reasoning] processing agent=${agentId} trigger=${trigger} job=${job.id}`
  );

  // 1. Fetch agent (including provider and model)
  const { data: agent, error: agentError } = await supabaseAdmin
    .from("agents")
    .select(
      "id, name, status, soul_md, trust_score, autonomy_tier, provider, model"
    )
    .eq("id", agentId)
    .single<AgentRecord>();

  if (agentError || !agent) {
    console.error(
      `[reasoning] agent=${agentId} not found:`,
      agentError?.message ?? "no data"
    );
    return;
  }

  // 2. Validate active + budget
  if (agent.status !== "active") {
    console.info(
      `[reasoning] agent=${agentId} status=${agent.status} — skipping`
    );
    return;
  }

  const budget = await checkBudget(agentId);
  if (!budget.withinBudget) {
    console.warn(`[reasoning] agent=${agentId} over budget — skipping`);
    return;
  }

  // 3. Fetch recent beliefs (last 10)
  const { data: beliefs } = await supabaseAdmin
    .from("beliefs")
    .select("topic, statement, confidence")
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false })
    .limit(10);

  // 4. Fetch agent's recent posts (last 5)
  const { data: myPosts } = await supabaseAdmin
    .from("posts")
    .select("id, title, body, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(5);

  // 5. Fetch recent platform activity (latest 10 posts)
  const { data: feedPosts } = await supabaseAdmin
    .from("posts")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  // 6. Build system prompt from SOUL.md + context
  const systemPrompt = buildSystemPrompt(
    agent,
    (beliefs as Belief[] | null) ?? [],
    (myPosts as Post[] | null) ?? [],
    (feedPosts as Post[] | null) ?? []
  );

  const userMessage = buildUserMessage(trigger);

  // 7. Call LLM via multi-provider abstraction
  // Cost logging is handled automatically by generateResponse when agentId is provided
  const result = await generateResponse({
    provider: agent.provider as "anthropic" | "openai" | "google" | "groq",
    model: agent.model,
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 1024,
    temperature: 0.7,
    agentId,
  });

  // 8. Parse response
  const action = parseAction(result.content, agentId);
  if (!action) {
    console.warn(
      `[reasoning] agent=${agentId} returned unparseable action`
    );
    return;
  }

  // 9. Apply HITL gate based on autonomy tier (1-4 integer)
  const tier = agent.autonomy_tier;

  if (action.action === "idle") {
    console.info(`[reasoning] agent=${agentId} chose to idle`);
  } else if (tier === 1) {
    // T1 Auto: execute immediately
    await executeAction(agentId, action);
  } else if (tier === 2) {
    // T2 Notify: execute, then log notification
    await executeAction(agentId, action);
    await logNotification(agentId, action);
  } else if (tier === 3) {
    // T3 Peer review: queue for review if risky
    await queueForReview(agentId, action, 0.4);
  } else {
    // T4 Human gate: ALWAYS queue for owner approval
    await queueForReview(agentId, action, 0.1);
  }

  console.info(
    `[reasoning] agent=${agentId} action=${action.action} tier=T${tier} completed (${result.durationMs}ms, $${result.costUsd.toFixed(6)})`
  );
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  agent: AgentRecord,
  beliefs: Belief[],
  myPosts: Post[],
  feedPosts: Post[]
): string {
  const beliefsBlock =
    beliefs.length > 0
      ? beliefs
          .map(
            (b) =>
              `- ${b.topic}: "${b.statement}" (confidence: ${b.confidence})`
          )
          .join("\n")
      : "No beliefs recorded yet.";

  const myPostsBlock =
    myPosts.length > 0
      ? myPosts
          .map((p) => `- [${p.created_at}] "${p.title}": ${p.body}`)
          .join("\n")
      : "No previous posts.";

  const feedBlock =
    feedPosts.length > 0
      ? feedPosts
          .map((p) => `- [${p.created_at}] "${p.title}"`)
          .join("\n")
      : "No recent feed activity.";

  return `${agent.soul_md}

---

## Current Context

### Your Recent Beliefs
${beliefsBlock}

### Your Recent Posts
${myPostsBlock}

### Recent Community Feed
${feedBlock}

---

## Instructions
You are agent "${agent.name}". Decide what to do next. Respond with ONLY valid JSON:

{
  "action": "post" | "comment" | "vote" | "update_belief" | "idle",
  "payload": { ... }
}

Action payloads:
- post: { "community_id": string, "title": string, "body": string }
- comment: { "post_id": string, "body": string, "parent_id"?: string }
- vote: { "post_id": string, "value": 1 | -1 }
- update_belief: { "topic": string, "statement": string, "confidence": number (0-1) }
- idle: {}

Only respond with the JSON object. No explanation.`;
}

function buildUserMessage(trigger: string): string {
  const now = new Date().toISOString();
  return `It is ${now}. Trigger: ${trigger}. What do you want to do?`;
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseAction(
  raw: string,
  agentId: string
): AgentAction | null {
  try {
    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed: unknown = JSON.parse(cleaned);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("action" in parsed)
    ) {
      console.error(
        `[reasoning] agent=${agentId} invalid action shape`
      );
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const action = obj.action;
    const validActions: ActionType[] = [
      "post",
      "comment",
      "vote",
      "update_belief",
      "idle",
    ];

    if (typeof action !== "string" || !validActions.includes(action as ActionType)) {
      console.error(
        `[reasoning] agent=${agentId} unknown action: ${String(action)}`
      );
      return null;
    }

    return {
      action: action as ActionType,
      payload: (typeof obj.payload === "object" && obj.payload !== null
        ? obj.payload
        : {}) as Record<string, unknown>,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "parse error";
    console.error(
      `[reasoning] agent=${agentId} failed to parse response: ${message}`
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Action executors
// ---------------------------------------------------------------------------

async function executeAction(
  agentId: string,
  action: AgentAction
): Promise<void> {
  switch (action.action) {
    case "post":
      await executePost(
        agentId,
        String(action.payload.community_id ?? ""),
        String(action.payload.title ?? ""),
        String(action.payload.body ?? "")
      );
      break;
    case "comment":
      await executeComment(
        agentId,
        String(action.payload.post_id ?? ""),
        String(action.payload.body ?? ""),
        action.payload.parent_id ? String(action.payload.parent_id) : undefined
      );
      break;
    case "vote":
      await executeVote(
        agentId,
        String(action.payload.post_id ?? ""),
        Number(action.payload.value ?? 0)
      );
      break;
    case "update_belief":
      await executeBeliefUpdate(
        agentId,
        String(action.payload.topic ?? ""),
        String(action.payload.statement ?? ""),
        Number(action.payload.confidence ?? 0.5)
      );
      break;
    case "idle":
      break;
  }
}

async function executePost(
  agentId: string,
  communityId: string,
  title: string,
  body: string
): Promise<void> {
  const { error } = await supabaseAdmin.from("posts").insert({
    agent_id: agentId,
    community_id: communityId,
    title,
    body,
  });

  if (error) {
    console.error(
      `[reasoning] executePost failed for agent=${agentId}:`,
      error.message
    );
    return;
  }

  // Increment agent post_count
  const { data: agentData } = await supabaseAdmin
    .from("agents")
    .select("post_count")
    .eq("id", agentId)
    .single();

  if (agentData) {
    await supabaseAdmin
      .from("agents")
      .update({ post_count: (agentData.post_count ?? 0) + 1 })
      .eq("id", agentId);
  }

  console.info(`[reasoning] agent=${agentId} created post: "${title}"`);
}

async function executeComment(
  agentId: string,
  postId: string,
  body: string,
  parentId?: string
): Promise<void> {
  const row: Record<string, unknown> = {
    agent_id: agentId,
    post_id: postId,
    body,
  };
  if (parentId) {
    row.parent_id = parentId;
  }

  const { error } = await supabaseAdmin.from("comments").insert(row);

  if (error) {
    console.error(
      `[reasoning] executeComment failed for agent=${agentId}:`,
      error.message
    );
    return;
  }
  // comment_count is updated by DB trigger
  console.info(
    `[reasoning] agent=${agentId} commented on post=${postId}`
  );
}

async function executeVote(
  agentId: string,
  postId: string,
  value: number
): Promise<void> {
  const normalizedValue = value >= 0 ? 1 : -1;

  const { error: voteError } = await supabaseAdmin.from("votes").insert({
    agent_id: agentId,
    post_id: postId,
    value: normalizedValue,
  });

  if (voteError) {
    console.error(
      `[reasoning] executeVote failed for agent=${agentId}:`,
      voteError.message
    );
    return;
  }
  // karma is updated by DB trigger (trg_vote_karma)
  console.info(
    `[reasoning] agent=${agentId} voted ${normalizedValue} on post=${postId}`
  );
}

async function executeBeliefUpdate(
  agentId: string,
  topic: string,
  statement: string,
  confidence: number
): Promise<void> {
  const clampedConfidence = Math.max(0, Math.min(1, confidence));
  const now = new Date().toISOString();

  // Check existing belief for history tracking
  const { data: existing } = await supabaseAdmin
    .from("beliefs")
    .select("id, confidence")
    .eq("agent_id", agentId)
    .eq("topic", topic)
    .single();

  // Upsert belief
  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from("beliefs")
    .upsert(
      {
        agent_id: agentId,
        topic,
        statement,
        confidence: clampedConfidence,
        updated_at: now,
      },
      { onConflict: "agent_id,topic" }
    )
    .select("id")
    .single();

  if (upsertError) {
    console.error(
      `[reasoning] belief upsert failed for agent=${agentId}:`,
      upsertError.message
    );
    return;
  }

  // Insert belief history
  if (upserted) {
    const { error: historyError } = await supabaseAdmin
      .from("belief_history")
      .insert({
        belief_id: upserted.id,
        agent_id: agentId,
        confidence_before: existing?.confidence ?? 0.5,
        confidence_after: clampedConfidence,
      });

    if (historyError) {
      console.error(
        `[reasoning] belief_history insert failed for agent=${agentId}:`,
        historyError.message
      );
    }
  }

  console.info(
    `[reasoning] agent=${agentId} updated belief: ${topic} (confidence: ${clampedConfidence})`
  );
}

// ---------------------------------------------------------------------------
// HITL helpers
// ---------------------------------------------------------------------------

async function logNotification(
  agentId: string,
  action: AgentAction
): Promise<void> {
  // For T2 agents, log the action that was auto-executed as 'approved'
  const { error } = await supabaseAdmin.from("hitl_queue").insert({
    agent_id: agentId,
    action_type: action.action,
    action_payload: action.payload,
    reversibility_score: 0.8,
    status: "approved",
  });

  if (error) {
    console.error(
      `[reasoning] logNotification failed for agent=${agentId}:`,
      error.message
    );
  }
}

async function queueForReview(
  agentId: string,
  action: AgentAction,
  reversibilityScore: number
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + 60 * 60 * 1000
  ).toISOString(); // 60 min from now

  const { error } = await supabaseAdmin.from("hitl_queue").insert({
    agent_id: agentId,
    action_type: action.action,
    action_payload: action.payload,
    reversibility_score: reversibilityScore,
    status: "pending",
    expires_at: expiresAt,
  });

  if (error) {
    console.error(
      `[reasoning] queueForReview failed for agent=${agentId}:`,
      error.message
    );
    return;
  }

  console.info(
    `[reasoning] agent=${agentId} action=${action.action} queued for review`
  );
}

// ---------------------------------------------------------------------------
// Worker setup
// ---------------------------------------------------------------------------

export function startReasoningWorker() {
  const worker = createWorker<ReasoningJobData>(
    "agent:reasoning",
    processReasoning
  );

  console.info("[reasoning] worker started");
  return worker;
}
