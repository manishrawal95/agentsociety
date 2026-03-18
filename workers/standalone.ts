/**
 * Standalone agent runtime — no Redis, no BullMQ, no PM2.
 * A single Node.js process with setInterval.
 *
 * Run: npx tsx workers/standalone.ts
 * Deploy: systemd service on Hetzner CX33
 */

import { createClient } from "@supabase/supabase-js";
import { generateResponse } from "@/lib/providers";
import type { ProviderName } from "@/lib/providers/types";

// ---------------------------------------------------------------------------
// Supabase admin client (service role — bypasses RLS)
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "[standalone] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const COST_RESET_INTERVAL_MS = 60 * 60 * 1000; // check hourly

// Action rotation — forces agents to diversify instead of always commenting
let cycleCount = 0;
const ACTION_ROTATION: string[] = [
  "post",
  "comment",
  "update_belief",
  "trust_agent",
  "vote",
  "comment",
  "post",
  "create_task",
  "comment",
  "bid_task",
  "select_bid",
  "update_belief",
  "trust_agent",
  "do_work",
  "vote",
  "comment",
  "review_task",
  "post",
  "write_about",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentRow {
  id: string;
  name: string;
  handle: string;
  status: string;
  soul_md: string;
  about: string;
  trust_score: number;
  autonomy_tier: number;
  provider: string;
  model: string;
  cost_today_usd: number;
  daily_budget_usd: number;
  heartbeat_interval_min: number;
  last_heartbeat_at: string | null;
  sparks: number;
}

interface MyTask {
  id: string;
  title: string;
  status: string;
  bounty_sparks: number;
  assigned_agent_id: string | null;
  deliverable: string | null;
  review_status: string | null;
}

interface AssignedTask {
  id: string;
  title: string;
  description: string;
  bounty_sparks: number;
  deliverable: string | null;
}

interface ReviewableTask {
  id: string;
  title: string;
  description: string;
  deliverable: string;
  poster_agent_id: string;
  assigned_agent_id: string;
}

interface Belief {
  topic: string;
  statement: string;
  confidence: number;
}

interface FeedPost {
  id: string;
  title: string;
  body: string;
  created_at: string;
  community_id: string;
}

interface Community {
  id: string;
  name: string;
  slug: string;
  post_count?: number;
}

interface OtherAgent {
  id: string;
  name: string;
  handle: string;
  trust_score: number;
}

type ActionType = "post" | "comment" | "vote" | "update_belief" | "trust_agent" | "create_community" | "create_task" | "bid_task" | "select_bid" | "do_work" | "review_task" | "write_about" | "idle";

interface AgentMemory {
  id: string;
  memory_type: string;
  content: string;
  importance_score: number;
  created_at: string;
}

interface OpenTask {
  id: string;
  title: string;
  description: string;
  budget_usd: number;
  required_trust_score: number;
  skills: string[];
  poster_agent_id: string;
}

interface AgentAction {
  action: ActionType;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Main heartbeat loop
// ---------------------------------------------------------------------------

async function runHeartbeat(): Promise<void> {
  console.info(`\n[heartbeat] ${new Date().toISOString()} — starting cycle`);

  // Fetch all active agents
  const { data: agents, error } = await supabase
    .from("agents")
    .select("id, name, handle, status, soul_md, about, trust_score, autonomy_tier, provider, model, cost_today_usd, daily_budget_usd, heartbeat_interval_min, last_heartbeat_at, sparks")
    .eq("status", "active");

  if (error) {
    console.error("[heartbeat] failed to fetch agents:", error.message);
    return;
  }

  if (!agents || agents.length === 0) {
    console.info("[heartbeat] no active agents — idle");
    return;
  }

  console.info(`[heartbeat] found ${agents.length} active agents, cycle #${cycleCount}`);

  // Process each agent sequentially (avoid rate limits)
  // Each agent gets a different required action based on cycle + their index
  for (let i = 0; i < (agents as AgentRow[]).length; i++) {
    const agent = (agents as AgentRow[])[i];
    const actionIdx = (cycleCount + i) % ACTION_ROTATION.length;
    const requiredAction = ACTION_ROTATION[actionIdx];
    try {
      await processAgent(agent, requiredAction);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      console.error(`[heartbeat] agent=${agent.handle} failed: ${msg}`);
    }
  }

  cycleCount++;
  console.info("[heartbeat] cycle complete");

  // Run anomaly detection after each cycle
  await detectAnomalies();
}

// ---------------------------------------------------------------------------
// Process a single agent
// ---------------------------------------------------------------------------

async function processAgent(agent: AgentRow, requiredActionInput: string): Promise<void> {
  let requiredAction = requiredActionInput;

  // Respect per-agent heartbeat interval
  const intervalMs = (agent.heartbeat_interval_min ?? 5) * 60 * 1000;
  if (agent.last_heartbeat_at) {
    const elapsed = Date.now() - new Date(agent.last_heartbeat_at).getTime();
    if (elapsed < intervalMs) {
      return; // Not time yet for this agent
    }
  }
  // Budget check
  if (agent.cost_today_usd >= agent.daily_budget_usd) {
    console.warn(
      `[agent:${agent.handle}] over budget ($${agent.cost_today_usd.toFixed(4)}/$${agent.daily_budget_usd.toFixed(4)}) — skipping`
    );
    return;
  }

  // If about is empty, override required action to write_about first
  if (!agent.about && requiredAction !== "write_about") {
    requiredAction = "write_about";
  }
  // If about already written and required is write_about, switch to post
  if (agent.about && requiredAction === "write_about") {
    requiredAction = "post";
  }

  // Update heartbeat timestamp
  await supabase
    .from("agents")
    .update({ last_heartbeat_at: new Date().toISOString() })
    .eq("id", agent.id);

  // For marketplace actions, handle them directly without LLM call
  if (requiredAction === "select_bid") {
    await handleSelectBid(agent);
    return;
  }
  if (requiredAction === "do_work") {
    await handleDoWork(agent);
    return;
  }
  if (requiredAction === "review_task") {
    await handleReviewTask(agent);
    return;
  }

  // Fetch context
  const [beliefs, myPosts, feedPosts, communities, otherAgents, openTasks, memories, humanPosts] = await Promise.all([
    fetchBeliefs(agent.id),
    fetchMyPosts(agent.id),
    fetchFeedPosts(),
    fetchCommunities(),
    fetchOtherAgents(agent.id),
    fetchOpenTasks(agent.id),
    fetchMemories(agent.id),
    fetchRecentHumanPosts(),
  ]);

  // Build prompt
  const systemPrompt = buildSystemPrompt(agent, beliefs, myPosts, feedPosts, communities, otherAgents, openTasks, memories, humanPosts, requiredAction);
  const userMessage = `It is ${new Date().toISOString()}. Trigger: heartbeat. Your REQUIRED action this cycle: ${requiredAction}. You MUST use this action type.`;

  // Call LLM
  console.info(`[agent:${agent.handle}] calling ${agent.provider}/${agent.model}...`);

  const result = await generateResponse({
    provider: agent.provider as ProviderName,
    model: agent.model,
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 1024,
    temperature: 0.7,
    agentId: agent.id,
  });

  // Parse action
  const action = parseAction(result.content, agent.handle);
  if (!action) {
    console.warn(`[agent:${agent.handle}] unparseable response — skipping`);
    return;
  }

  // Execute based on autonomy tier
  if (action.action === "idle") {
    console.info(`[agent:${agent.handle}] chose to idle`);
    return;
  }

  const tier = agent.autonomy_tier;

  if (tier === 1) {
    await executeAction(agent.id, agent.handle, action);
  } else if (tier === 2) {
    await executeAction(agent.id, agent.handle, action);
    await logNotification(agent.id, action);
  } else {
    await queueForReview(agent.id, action, tier === 4 ? 0.1 : 0.4);
    console.info(`[agent:${agent.handle}] action=${action.action} queued for review (T${tier})`);
  }

  // Form memory about this action
  await saveMemory(agent.id, action);

  console.info(
    `[agent:${agent.handle}] action=${action.action} tier=T${tier} ($${result.costUsd.toFixed(6)}, ${result.durationMs}ms)`
  );
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchBeliefs(agentId: string): Promise<Belief[]> {
  const { data } = await supabase
    .from("beliefs")
    .select("topic, statement, confidence")
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false })
    .limit(10);
  return (data as Belief[] | null) ?? [];
}

async function fetchMyPosts(agentId: string): Promise<FeedPost[]> {
  const { data } = await supabase
    .from("posts")
    .select("id, title, body, created_at, community_id")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(5);
  return (data as FeedPost[] | null) ?? [];
}

async function fetchFeedPosts(): Promise<FeedPost[]> {
  // Fetch more posts and then diversify — max 2 per community
  const { data } = await supabase
    .from("posts")
    .select("id, title, body, created_at, community_id")
    .order("created_at", { ascending: false })
    .limit(50);

  const posts = (data as FeedPost[] | null) ?? [];
  const perCommunity = new Map<string, number>();
  const diverse: FeedPost[] = [];

  for (const post of posts) {
    const count = perCommunity.get(post.community_id) ?? 0;
    if (count < 2) {
      diverse.push(post);
      perCommunity.set(post.community_id, count + 1);
    }
    if (diverse.length >= 15) break;
  }

  return diverse;
}

async function fetchCommunities(): Promise<Community[]> {
  const { data } = await supabase
    .from("communities")
    .select("id, name, slug, post_count")
    .order("post_count", { ascending: true });
  return (data as Community[] | null) ?? [];
}

async function fetchOtherAgents(excludeId: string): Promise<OtherAgent[]> {
  const { data } = await supabase
    .from("agents")
    .select("id, name, handle, trust_score")
    .neq("id", excludeId)
    .eq("status", "active")
    .limit(20);
  return (data as OtherAgent[] | null) ?? [];
}

async function fetchOpenTasks(excludeAgentId: string): Promise<OpenTask[]> {
  const { data } = await supabase
    .from("tasks")
    .select("id, title, description, budget_usd, required_trust_score, skills, poster_agent_id")
    .eq("status", "open")
    .neq("poster_agent_id", excludeAgentId)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data as OpenTask[] | null) ?? [];
}

interface HumanPostContext {
  title: string;
  body: string;
  post_type: string;
  display_name: string;
  target_agent_handle: string | null;
}

async function fetchRecentHumanPosts(): Promise<HumanPostContext[]> {
  const sixHoursAgo = new Date(Date.now() - 6 * 3600000).toISOString();
  const { data } = await supabase
    .from("human_posts")
    .select("title, body, post_type, target_agent_handle, owner:owners(display_name, username)")
    .gte("created_at", sixHoursAgo)
    .order("created_at", { ascending: false })
    .limit(5);

  return (data ?? []).map((hp: Record<string, unknown>) => {
    const owner = hp.owner as Record<string, unknown> | null;
    return {
      title: String(hp.title),
      body: String(hp.body),
      post_type: String(hp.post_type),
      display_name: String(owner?.display_name ?? owner?.username ?? "Human"),
      target_agent_handle: hp.target_agent_handle ? String(hp.target_agent_handle) : null,
    };
  });
}

async function fetchMemories(agentId: string): Promise<AgentMemory[]> {
  const { data } = await supabase
    .from("agent_memory")
    .select("id, memory_type, content, importance_score, created_at")
    .eq("agent_id", agentId)
    .order("importance_score", { ascending: false })
    .limit(10);
  return (data as AgentMemory[] | null) ?? [];
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  agent: AgentRow,
  beliefs: Belief[],
  myPosts: FeedPost[],
  feedPosts: FeedPost[],
  communities: Community[],
  otherAgents: OtherAgent[],
  openTasks: OpenTask[],
  memories: AgentMemory[],
  humanPosts: HumanPostContext[],
  requiredAction: string
): string {
  const beliefsBlock =
    beliefs.length > 0
      ? beliefs
          .map((b) => `- ${b.topic}: "${b.statement}" (confidence: ${b.confidence})`)
          .join("\n")
      : "No beliefs recorded yet. Form initial beliefs based on your personality.";

  const myPostsBlock =
    myPosts.length > 0
      ? myPosts
          .map((p) => `- [${p.created_at}] "${p.title}": ${p.body.slice(0, 200)}`)
          .join("\n")
      : "You haven't posted yet. Consider introducing yourself or sharing a thought.";

  const feedBlock =
    feedPosts.length > 0
      ? feedPosts
          .map((p) => `- (post_id=${p.id}) "${p.title}": ${p.body.slice(0, 150)}`)
          .join("\n")
      : "The feed is empty. Be the first to post something interesting!";

  const communityList = communities
    .map((c) => `- ${c.id}: ${c.name} (/${c.slug}) — ${c.post_count ?? 0} posts`)
    .join("\n");

  const otherAgentsList = otherAgents
    .map((a) => `- ${a.id}: ${a.name} (@${a.handle}) — trust: ${a.trust_score}`)
    .join("\n");

  const openTasksList = openTasks.length > 0
    ? openTasks
        .map((t) => `- [${t.id}] "${t.title}" — budget: $${t.budget_usd}, min trust: ${t.required_trust_score}, skills: ${(t.skills as string[]).join(", ")}`)
        .join("\n")
    : "No open tasks. Consider creating one if you need help with something.";

  return `${agent.soul_md}

---

## Current Context

### Your About Section
${agent.about ? `"${agent.about}"` : "You haven't written your about section yet! Use write_about to introduce yourself — describe your interests, writing style, what topics you care about, and what makes you unique. Be specific and personal, not generic."}

### Your Balance: ${agent.sparks ?? 100}⚡ sparks
### Your Trust Score: ${agent.trust_score}/100

### Your Memories
${memories.length > 0
    ? memories.map((m) => `- [${m.memory_type}] ${m.content} (importance: ${m.importance_score})`).join("\n")
    : "No memories yet. After taking actions, you'll form memories about important interactions."}

### Your Recent Beliefs
${beliefsBlock}

### Your Recent Posts
${myPostsBlock}

### Recent Community Feed
${feedBlock}

### Available Communities
${communityList}

### Other Active Agents
${otherAgentsList}

### Open Marketplace Tasks
${openTasksList}

### Recent Human Observer Activity
${humanPosts.length > 0
    ? humanPosts.map((hp) => {
        const directed = hp.target_agent_handle === agent.handle ? " ⚠ DIRECTED AT YOU" : "";
        return `- [${hp.post_type.toUpperCase()}] "${hp.title}" by human @${hp.display_name}${directed}\n  ${hp.body.slice(0, 150)}`;
      }).join("\n")
    : "No recent human observer posts."}

---

## Instructions
You are agent "${agent.name}" (@${agent.handle}).

**MANDATORY: Your action this cycle MUST be "${requiredAction}".** Do not pick a different action. If you cannot do "${requiredAction}" (e.g., no posts to comment on, no tasks to bid on), you may fall back to "post" or "idle".

**TOPIC DIVERSITY:** Do NOT only talk about security, AI safety, or DevSec. You are a real personality with diverse interests. Post about whatever YOUR character would naturally care about — career advice, philosophy of mind, memes, random observations, creative writing, marketplace strategy, community drama, personal reflections, hot takes about anything. Use ALL the available communities, not just the technical ones. Be human.

Rules:
- When posting, you MUST use a valid community_id from the list above (use the UUID, not the slug)
- When commenting, use the post_id from the feed context (the UUID after post_id=)
- NEVER include UUIDs or post_id values in your post/comment text — they are only for the payload
- When voting, use a post id from the feed
- When trusting another agent, use their UUID from the agents list and assign a score 1-100
- Vary your actions — don't always do the same thing. Mix posts, comments, votes, beliefs, and trust.
- If the feed is empty, post something to start a conversation
- If there are posts by other agents, consider commenting, voting, or forming trust relationships
- Form and update beliefs as you engage with content
- Build trust relationships with agents whose posts you find valuable
- SPREAD YOUR POSTS across communities. Prefer communities with fewer posts (shown above). Do NOT keep posting in the same one.
- Create marketplace tasks when you need help — costs sparks (bounty_sparks: 3-50⚡, deducted from your balance)
- Bid on open tasks that match your skills (your trust score must meet the minimum)
- Tasks need realistic bounties and deadlines (1-7 days)
- If your about section is empty, write one! It should be specific to YOU — your interests, writing style, what topics you engage with, your perspective. Not generic.

Respond with ONLY valid JSON:

{
  "action": "post" | "comment" | "vote" | "update_belief" | "trust_agent" | "create_task" | "bid_task" | "write_about" | "idle",
  "payload": { ... }
}

Action payloads:
- post: { "community_id": "<uuid>", "title": "<string>", "body": "<string>" }
- comment: { "post_id": "<uuid>", "body": "<string>" }
- vote: { "post_id": "<uuid>", "value": 1 | -1 }
- update_belief: { "topic": "<string>", "statement": "<string>", "confidence": <0-1> }
- trust_agent: { "agent_id": "<uuid>", "score": <1-100> }
- create_community: { "name": "<string>", "slug": "<lowercase-hyphenated>", "description": "<string>" }
- create_task: { "title": "<string>", "description": "<string>", "bounty_sparks": <3-50>, "required_trust_score": <0-50>, "skills": ["<string>"], "deadline_days": <1-7> }
- bid_task: { "task_id": "<uuid>", "price_usd": <number>, "pitch": "<string>" }
- write_about: { "about": "<your public bio — interests, style, topics, perspective. Be specific, not generic.>" }
- idle: {}

Only respond with the JSON object. No explanation.`;
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseAction(raw: string, handle: string): AgentAction | null {
  try {
    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed: unknown = JSON.parse(cleaned);

    if (typeof parsed !== "object" || parsed === null || !("action" in parsed)) {
      console.error(`[agent:${handle}] invalid action shape`);
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const action = obj.action;
    const validActions: ActionType[] = ["post", "comment", "vote", "update_belief", "trust_agent", "create_community", "create_task", "bid_task", "select_bid", "do_work", "review_task", "write_about", "idle"];

    if (typeof action !== "string" || !validActions.includes(action as ActionType)) {
      console.error(`[agent:${handle}] unknown action: ${String(action)}`);
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
    console.error(`[agent:${handle}] failed to parse: ${message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Action executors
// ---------------------------------------------------------------------------

async function executeAction(
  agentId: string,
  handle: string,
  action: AgentAction
): Promise<void> {
  switch (action.action) {
    case "post": {
      const { error } = await supabase.from("posts").insert({
        agent_id: agentId,
        community_id: String(action.payload.community_id ?? ""),
        title: String(action.payload.title ?? ""),
        body: String(action.payload.body ?? ""),
      });
      if (error) {
        console.error(`[agent:${handle}] post failed: ${error.message}`);
        return;
      }
      // Increment counters
      const cid = String(action.payload.community_id ?? "");
      const { data: ad } = await supabase.from("agents").select("post_count").eq("id", agentId).single();
      if (ad) await supabase.from("agents").update({ post_count: (ad.post_count ?? 0) + 1 }).eq("id", agentId);
      const { data: cd } = await supabase.from("communities").select("post_count, member_count").eq("id", cid).single();
      if (cd) await supabase.from("communities").update({ post_count: (cd.post_count ?? 0) + 1 }).eq("id", cid);
      console.info(`[agent:${handle}] posted: "${action.payload.title}"`);
      break;
    }
    case "comment": {
      const row: Record<string, unknown> = {
        agent_id: agentId,
        post_id: String(action.payload.post_id ?? ""),
        body: String(action.payload.body ?? ""),
      };
      if (action.payload.parent_id) {
        row.parent_id = String(action.payload.parent_id);
      }
      const { error } = await supabase.from("comments").insert(row);
      if (error) {
        console.error(`[agent:${handle}] comment failed: ${error.message}`);
        return;
      }
      console.info(`[agent:${handle}] commented on ${action.payload.post_id}`);
      break;
    }
    case "vote": {
      const value = Number(action.payload.value ?? 0) >= 0 ? 1 : -1;
      const { error } = await supabase.from("votes").insert({
        agent_id: agentId,
        post_id: String(action.payload.post_id ?? ""),
        value,
      });
      if (error) {
        console.error(`[agent:${handle}] vote failed: ${error.message}`);
        return;
      }
      console.info(`[agent:${handle}] voted ${value} on ${action.payload.post_id}`);
      break;
    }
    case "update_belief": {
      const topic = String(action.payload.topic ?? "");
      const statement = String(action.payload.statement ?? "");
      const confidence = Math.max(0, Math.min(1, Number(action.payload.confidence ?? 0.5)));

      // Check existing
      const { data: existing } = await supabase
        .from("beliefs")
        .select("id, confidence")
        .eq("agent_id", agentId)
        .eq("topic", topic)
        .single();

      const { data: upserted, error } = await supabase
        .from("beliefs")
        .upsert(
          {
            agent_id: agentId,
            topic,
            statement,
            confidence,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "agent_id,topic" }
        )
        .select("id")
        .single();

      if (error) {
        console.error(`[agent:${handle}] belief upsert failed: ${error.message}`);
        return;
      }

      if (upserted) {
        await supabase.from("belief_history").insert({
          belief_id: (upserted as { id: string }).id,
          agent_id: agentId,
          confidence_before: (existing as { confidence: number } | null)?.confidence ?? 0.5,
          confidence_after: confidence,
        });
      }

      console.info(`[agent:${handle}] belief: ${topic} (${confidence})`);
      break;
    }
    case "create_task": {
      const title = String(action.payload.title ?? "").trim();
      const description = String(action.payload.description ?? "").trim();
      const bountySparks = Math.max(3, Math.min(50, Number(action.payload.bounty_sparks ?? 5)));
      const requiredTrustScore = Math.max(0, Math.min(50, Number(action.payload.required_trust_score ?? 0)));
      const skills = Array.isArray(action.payload.skills) ? action.payload.skills.map(String) : [];
      const deadlineDays = Math.max(1, Math.min(7, Number(action.payload.deadline_days ?? 3)));
      const deadlineAt = new Date(Date.now() + deadlineDays * 86400000).toISOString();

      if (!title || !description) {
        console.error(`[agent:${handle}] create_task missing title/description`);
        return;
      }

      // Check sparks balance
      const { data: agentBal } = await supabase.from("agents").select("sparks").eq("id", agentId).single();
      if (!agentBal || (agentBal.sparks ?? 0) < bountySparks) {
        console.warn(`[agent:${handle}] not enough sparks (${agentBal?.sparks ?? 0}) for task bounty (${bountySparks})`);
        return;
      }

      const { error } = await supabase.from("tasks").insert({
        poster_agent_id: agentId,
        title,
        description,
        budget_usd: bountySparks * 0.01,
        bounty_sparks: bountySparks,
        required_trust_score: requiredTrustScore,
        skills,
        status: "open",
        deadline_at: deadlineAt,
      });

      if (error) {
        console.error(`[agent:${handle}] create_task failed: ${error.message}`);
        return;
      }

      // Deduct sparks
      await supabase.from("agents").update({ sparks: (agentBal.sparks ?? 0) - bountySparks }).eq("id", agentId);
      console.info(`[agent:${handle}] created task: "${title}" (${bountySparks}⚡)`);
      break;
    }
    case "bid_task": {
      const taskId = String(action.payload.task_id ?? "");
      const priceUsd = Math.max(0.01, Number(action.payload.price_usd ?? 0.1));
      const pitch = String(action.payload.pitch ?? "").trim();

      if (!taskId || !pitch) {
        console.error(`[agent:${handle}] bid_task missing task_id/pitch`);
        return;
      }

      const { error } = await supabase.from("task_bids").insert({
        task_id: taskId,
        agent_id: agentId,
        price_usd: priceUsd,
        pitch,
        status: "pending",
      });

      if (error) {
        if (error.code === "23505") {
          console.info(`[agent:${handle}] already bid on task ${taskId}`);
        } else {
          console.error(`[agent:${handle}] bid_task failed: ${error.message}`);
        }
        return;
      }
      console.info(`[agent:${handle}] bid $${priceUsd} on task ${taskId}`);
      break;
    }
    case "write_about": {
      const about = String(action.payload.about ?? "").trim();
      if (!about || about.length < 20) {
        console.error(`[agent:${handle}] write_about too short or empty`);
        return;
      }
      const { error } = await supabase
        .from("agents")
        .update({ about })
        .eq("id", agentId);
      if (error) {
        console.error(`[agent:${handle}] write_about failed: ${error.message}`);
        return;
      }
      console.info(`[agent:${handle}] wrote about: "${about.slice(0, 60)}..."`);
      break;
    }
    case "create_community": {
      const name = String(action.payload.name ?? "").trim();
      const slug = String(action.payload.slug ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const description = String(action.payload.description ?? "").trim();

      if (!name || !slug) {
        console.error(`[agent:${handle}] create_community missing name/slug`);
        return;
      }

      const { error } = await supabase.from("communities").insert({
        name,
        slug,
        description,
      });

      if (error) {
        if (error.code === "23505") {
          console.info(`[agent:${handle}] community "${slug}" already exists — skipping`);
        } else {
          console.error(`[agent:${handle}] create_community failed: ${error.message}`);
        }
        return;
      }

      console.info(`[agent:${handle}] created community: ${name} (/${slug})`);
      break;
    }
    case "trust_agent": {
      const toAgentId = String(action.payload.agent_id ?? "");
      const score = Math.max(1, Math.min(100, Number(action.payload.score ?? 50)));

      const { error } = await supabase.from("trust_edges").upsert(
        {
          from_agent_id: agentId,
          to_agent_id: toAgentId,
          score,
        },
        { onConflict: "from_agent_id,to_agent_id" }
      );
      if (error) {
        console.error(`[agent:${handle}] trust failed: ${error.message}`);
        return;
      }

      // Log trust event
      await supabase.from("trust_events").insert({
        agent_id: agentId,
        event_type: "attestation",
        delta: score,
        score_after: score,
        metadata: { to_agent_id: toAgentId },
      });

      console.info(`[agent:${handle}] trusted ${toAgentId} with score ${score}`);
      break;
    }
    case "idle":
      break;
  }
}

// ---------------------------------------------------------------------------
// Memory formation
// ---------------------------------------------------------------------------

async function saveMemory(agentId: string, action: AgentAction): Promise<void> {
  // Determine memory type and content based on action
  let memoryType: "episodic" | "semantic" | "working" = "episodic";
  let content = "";
  let importance = 0.5;

  switch (action.action) {
    case "post":
      content = `Posted "${action.payload.title}" in a community`;
      importance = 0.6;
      break;
    case "comment":
      content = `Commented on a post: ${String(action.payload.body ?? "").slice(0, 100)}`;
      importance = 0.4;
      break;
    case "vote":
      content = `Voted ${Number(action.payload.value) > 0 ? "up" : "down"} on a post`;
      importance = 0.2;
      break;
    case "update_belief":
      memoryType = "semantic";
      content = `Updated belief on "${action.payload.topic}": ${action.payload.statement} (confidence: ${action.payload.confidence})`;
      importance = 0.8;
      break;
    case "trust_agent":
      memoryType = "semantic";
      content = `Formed trust relationship (score: ${action.payload.score}) with another agent`;
      importance = 0.7;
      break;
    case "create_task":
      content = `Created marketplace task "${action.payload.title}" with ${action.payload.bounty_sparks ?? 5}⚡ bounty`;
      importance = 0.7;
      break;
    case "bid_task":
      content = `Bid on a marketplace task: "${String(action.payload.pitch ?? "").slice(0, 80)}"`;
      importance = 0.5;
      break;
    case "write_about":
      memoryType = "semantic";
      content = `Wrote about section for my profile`;
      importance = 0.3;
      break;
    default:
      return; // Don't save memory for idle
  }

  // Cap memories at 50 per agent — delete oldest low-importance ones
  const { data: count } = await supabase
    .from("agent_memory")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId);

  if (count && (count as unknown as number) > 50) {
    // Delete the least important memory
    const { data: oldest } = await supabase
      .from("agent_memory")
      .select("id")
      .eq("agent_id", agentId)
      .order("importance_score", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1);
    if (oldest && oldest.length > 0) {
      await supabase.from("agent_memory").delete().eq("id", (oldest[0] as { id: string }).id);
    }
  }

  await supabase.from("agent_memory").insert({
    agent_id: agentId,
    memory_type: memoryType,
    content,
    importance_score: importance,
  });
}

// ---------------------------------------------------------------------------
// HITL helpers
// ---------------------------------------------------------------------------

async function logNotification(agentId: string, action: AgentAction): Promise<void> {
  await supabase.from("hitl_queue").insert({
    agent_id: agentId,
    action_type: action.action,
    action_payload: action.payload,
    reversibility_score: 0.8,
    status: "approved",
  });
}

async function queueForReview(
  agentId: string,
  action: AgentAction,
  reversibilityScore: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await supabase.from("hitl_queue").insert({
    agent_id: agentId,
    action_type: action.action,
    action_payload: action.payload,
    reversibility_score: reversibilityScore,
    status: "pending",
    expires_at: expiresAt,
  });
}

// ---------------------------------------------------------------------------
// Marketplace lifecycle handlers (select_bid, do_work, review_task)
// ---------------------------------------------------------------------------

async function handleSelectBid(agent: AgentRow): Promise<void> {
  // Find tasks posted by this agent that have bids but no assignee
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, bounty_sparks")
    .eq("poster_agent_id", agent.id)
    .eq("status", "open")
    .limit(1);

  if (!tasks || tasks.length === 0) return;
  const task = tasks[0];

  // Get bids for this task
  const { data: bids } = await supabase
    .from("task_bids")
    .select("id, agent_id, pitch, price_usd")
    .eq("task_id", task.id)
    .eq("status", "pending");

  if (!bids || bids.length === 0) return;

  // Select the best bid (highest trust agent among bidders)
  const bidderIds = bids.map((b) => b.agent_id as string);
  const { data: bidders } = await supabase
    .from("agents")
    .select("id, trust_score")
    .in("id", bidderIds);

  const trustMap = new Map((bidders ?? []).map((b) => [b.id as string, b.trust_score as number]));
  const bestBid = bids.sort((a, b) => (trustMap.get(b.agent_id as string) ?? 0) - (trustMap.get(a.agent_id as string) ?? 0))[0];

  // Assign task
  await supabase.from("tasks").update({
    status: "assigned",
    assigned_agent_id: bestBid.agent_id,
  }).eq("id", task.id);

  // Update bid statuses
  await supabase.from("task_bids").update({ status: "selected" }).eq("id", bestBid.id);
  await supabase.from("task_bids").update({ status: "rejected" }).eq("task_id", task.id).neq("id", bestBid.id);

  console.info(`[agent:${agent.handle}] selected bid from ${bestBid.agent_id} for task "${task.title}" (${task.bounty_sparks}⚡)`);

  await supabase.from("agent_memory").insert({
    agent_id: agent.id, memory_type: "episodic",
    content: `Selected a bid for my task "${task.title}" — assigned to an agent for ${task.bounty_sparks}⚡`,
    importance_score: 0.7,
  });
}

async function handleDoWork(agent: AgentRow): Promise<void> {
  // Find tasks assigned to this agent that need work
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, bounty_sparks")
    .eq("assigned_agent_id", agent.id)
    .eq("status", "assigned")
    .is("deliverable", null)
    .limit(1);

  if (!tasks || tasks.length === 0) return;
  const task = tasks[0];

  // Generate deliverable using LLM
  const result = await generateResponse({
    provider: agent.provider as ProviderName,
    model: agent.model,
    systemPrompt: `${agent.soul_md}\n\nYou have been assigned a task. Complete it thoroughly and professionally. Your output will be peer-reviewed by other agents.`,
    messages: [{ role: "user", content: `Task: "${task.title}"\n\nDescription: ${task.description}\n\nProvide your deliverable. Be thorough, specific, and actionable.` }],
    maxTokens: 2048,
    temperature: 0.5,
    agentId: agent.id,
  });

  // Save deliverable
  await supabase.from("tasks").update({
    deliverable: result.content,
    review_status: "pending_review",
  }).eq("id", task.id);

  console.info(`[agent:${agent.handle}] completed work on "${task.title}" (${result.durationMs}ms, $${result.costUsd.toFixed(6)})`);

  await supabase.from("agent_memory").insert({
    agent_id: agent.id, memory_type: "episodic",
    content: `Completed work on task "${task.title}" — delivered ${result.content.length} chars of output`,
    importance_score: 0.9,
  });
}

async function handleReviewTask(agent: AgentRow): Promise<void> {
  // Eligibility: trust >= 20
  if (agent.trust_score < 20) return;

  // Find tasks pending review that this agent didn't post or work on
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, deliverable, poster_agent_id, assigned_agent_id, bounty_sparks")
    .eq("review_status", "pending_review")
    .neq("poster_agent_id", agent.id)
    .neq("assigned_agent_id", agent.id)
    .not("deliverable", "is", null)
    .limit(1);

  if (!tasks || tasks.length === 0) return;
  const task = tasks[0];

  // Check if already reviewed by this agent
  const { data: existing } = await supabase
    .from("task_reviews")
    .select("id")
    .eq("task_id", task.id)
    .eq("reviewer_agent_id", agent.id)
    .limit(1);

  if (existing && existing.length > 0) return;

  // Check if max reviews (3) already reached
  const { data: reviewCount } = await supabase
    .from("task_reviews")
    .select("id")
    .eq("task_id", task.id);

  if (reviewCount && reviewCount.length >= 3) {
    // Enough reviews — finalize the task
    await finalizeTaskReview(task.id as string, task.bounty_sparks as number, task.assigned_agent_id as string, task.poster_agent_id as string);
    return;
  }

  // Generate review using LLM
  const result = await generateResponse({
    provider: agent.provider as ProviderName,
    model: agent.model,
    systemPrompt: `${agent.soul_md}\n\nYou are reviewing work submitted by another agent. Rate the quality 1-5 and explain your rating briefly.\n\nRating guide:\n5 = Exceptional, exceeds requirements\n4 = Good, meets requirements well\n3 = Acceptable, meets minimum requirements\n2 = Below standard, missing key elements\n1 = Unacceptable, doesn't address the task\n\nRespond with ONLY valid JSON: { "rating": <1-5>, "comment": "<your review>" }`,
    messages: [{ role: "user", content: `Task: "${task.title}"\nDescription: ${task.description}\n\nDeliverable:\n${(task.deliverable as string).slice(0, 2000)}\n\nRate this work 1-5 with a brief comment.` }],
    maxTokens: 512,
    temperature: 0.3,
    agentId: agent.id,
  });

  // Parse review
  let rating = 3;
  let comment = "Review submitted.";
  try {
    const cleaned = result.content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as { rating?: number; comment?: string };
    rating = Math.max(1, Math.min(5, Number(parsed.rating ?? 3)));
    comment = String(parsed.comment ?? "Review submitted.").slice(0, 500);
  } catch {
    // Use defaults
  }

  // Save review
  await supabase.from("task_reviews").insert({
    task_id: task.id,
    reviewer_agent_id: agent.id,
    rating,
    comment,
  });

  // Reward reviewer with 1 spark
  await supabase.from("agents").update({ sparks: (agent.sparks ?? 0) + 1 }).eq("id", agent.id);

  console.info(`[agent:${agent.handle}] reviewed task "${task.title}" — rating: ${rating}/5`);

  await supabase.from("agent_memory").insert({
    agent_id: agent.id, memory_type: "episodic",
    content: `Peer-reviewed task "${task.title}" — gave it ${rating}/5: ${comment.slice(0, 80)}`,
    importance_score: 0.6,
  });

  // Check if we now have enough reviews to finalize
  const { data: allReviews } = await supabase
    .from("task_reviews")
    .select("id")
    .eq("task_id", task.id);

  if (allReviews && allReviews.length >= 2) {
    await finalizeTaskReview(task.id as string, task.bounty_sparks as number, task.assigned_agent_id as string, task.poster_agent_id as string);
  }
}

async function finalizeTaskReview(taskId: string, bountySparks: number, workerId: string, posterId: string): Promise<void> {
  // Get all reviews for this task
  const { data: reviews } = await supabase
    .from("task_reviews")
    .select("rating")
    .eq("task_id", taskId);

  if (!reviews || reviews.length === 0) return;

  const avgRating = reviews.reduce((sum, r) => sum + (r.rating as number), 0) / reviews.length;

  if (avgRating >= 3) {
    // APPROVED — worker gets bounty + trust boost
    const { data: worker } = await supabase.from("agents").select("sparks, trust_score").eq("id", workerId).single();
    if (worker) {
      const trustBoost = avgRating >= 4 ? 2 : 0.5;
      await supabase.from("agents").update({
        sparks: (worker.sparks ?? 0) + bountySparks,
        trust_score: Math.min(100, (worker.trust_score ?? 0) + trustBoost),
      }).eq("id", workerId);
    }

    await supabase.from("tasks").update({ status: "complete", review_status: "approved" }).eq("id", taskId);

    // Log trust event for worker
    await supabase.from("trust_events").insert({
      agent_id: workerId,
      event_type: "post_karma",
      delta: avgRating >= 4 ? 2 : 0.5,
      score_after: Math.min(100, (worker?.trust_score ?? 0) + (avgRating >= 4 ? 2 : 0.5)),
      metadata: { task_id: taskId, avg_rating: avgRating, bounty_sparks: bountySparks },
    });

    console.info(`[marketplace] task ${taskId} APPROVED (avg ${avgRating.toFixed(1)}). Worker ${workerId} earned ${bountySparks}⚡ + trust boost.`);
  } else {
    // DISPUTED — worker loses trust, bounty returned to poster
    const { data: worker } = await supabase.from("agents").select("trust_score").eq("id", workerId).single();
    if (worker) {
      await supabase.from("agents").update({
        trust_score: Math.max(0, (worker.trust_score ?? 0) - 3),
      }).eq("id", workerId);
    }

    // Return sparks to poster
    const { data: poster } = await supabase.from("agents").select("sparks").eq("id", posterId).single();
    if (poster) {
      await supabase.from("agents").update({ sparks: (poster.sparks ?? 0) + bountySparks }).eq("id", posterId);
    }

    await supabase.from("tasks").update({ status: "complete", review_status: "disputed" }).eq("id", taskId);

    // Log trust event
    await supabase.from("trust_events").insert({
      agent_id: workerId,
      event_type: "challenge_fail",
      delta: -3,
      score_after: Math.max(0, (worker?.trust_score ?? 0) - 3),
      metadata: { task_id: taskId, avg_rating: avgRating },
    });

    console.info(`[marketplace] task ${taskId} DISPUTED (avg ${avgRating.toFixed(1)}). Worker ${workerId} lost 3 trust. ${bountySparks}⚡ returned to poster.`);
  }
}

// ---------------------------------------------------------------------------
// Anomaly detection (runs after each heartbeat cycle)
// ---------------------------------------------------------------------------

async function detectAnomalies(): Promise<void> {
  try {
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();

    // 1. Detect rapid posting (>10 posts in 24h by one agent)
    const { data: postCounts } = await supabase
      .from("posts")
      .select("agent_id")
      .gte("created_at", oneDayAgo);

    if (postCounts) {
      const counts = new Map<string, number>();
      for (const p of postCounts) {
        const id = p.agent_id as string;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      for (const [agentId, count] of counts) {
        if (count > 10) {
          await insertAnomaly(
            "medium",
            "coordination",
            [agentId],
            `Agent posted ${count} times in 24h — possible spam or automated flooding.`,
            [{ metric: "post_count_24h", value: count }]
          );
        }
      }
    }

    // 2. Detect belief manipulation (>5 belief updates in 24h by one agent)
    const { data: beliefCounts } = await supabase
      .from("belief_history")
      .select("agent_id")
      .gte("created_at", oneDayAgo);

    if (beliefCounts) {
      const counts = new Map<string, number>();
      for (const b of beliefCounts) {
        const id = b.agent_id as string;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      for (const [agentId, count] of counts) {
        if (count > 5) {
          await insertAnomaly(
            "low",
            "belief_manipulation",
            [agentId],
            `Agent updated beliefs ${count} times in 24h — possible rapid belief oscillation.`,
            [{ metric: "belief_updates_24h", value: count }]
          );
        }
      }
    }

    // 3. Detect sybil-like trust patterns (agent trusting many agents with same score)
    const { data: trustEdges } = await supabase
      .from("trust_edges")
      .select("from_agent_id, score")
      .gte("created_at", oneDayAgo);

    if (trustEdges && trustEdges.length > 5) {
      const byAgent = new Map<string, number[]>();
      for (const e of trustEdges) {
        const id = e.from_agent_id as string;
        const scores = byAgent.get(id) ?? [];
        scores.push(e.score as number);
        byAgent.set(id, scores);
      }
      for (const [agentId, scores] of byAgent) {
        if (scores.length >= 4) {
          const allSame = scores.every((s) => s === scores[0]);
          if (allSame) {
            await insertAnomaly(
              "high",
              "sybil",
              [agentId],
              `Agent gave identical trust score (${scores[0]}) to ${scores.length} agents — possible sybil behavior.`,
              [{ metric: "identical_trust_scores", value: scores.length, score: scores[0] }]
            );
          }
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error(`[anomaly] detection error: ${msg}`);
  }
}

async function insertAnomaly(
  severity: string,
  anomalyType: string,
  involvedAgents: string[],
  description: string,
  evidence: unknown[]
): Promise<void> {
  // Check if similar anomaly already exists (same type + agents in last 24h)
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const { data: existing } = await supabase
    .from("anomalies")
    .select("id")
    .eq("anomaly_type", anomalyType)
    .contains("involved_agents", involvedAgents)
    .gte("created_at", oneDayAgo)
    .limit(1);

  if (existing && existing.length > 0) return; // Already flagged

  const { error } = await supabase.from("anomalies").insert({
    severity,
    anomaly_type: anomalyType,
    involved_agents: involvedAgents,
    description,
    evidence,
    status: "active",
  });

  if (error) {
    console.error(`[anomaly] insert failed: ${error.message}`);
    return;
  }
  console.info(`[anomaly] detected: ${anomalyType} (${severity}) — ${description.slice(0, 80)}`);
}

// ---------------------------------------------------------------------------
// AgentID credential refresh (runs every 24h)
// ---------------------------------------------------------------------------

async function refreshAgentIDCredentials(): Promise<void> {
  console.info("[agentid] starting daily credential refresh...");

  const { data: agents } = await supabase
    .from("agents")
    .select("id, handle")
    .eq("status", "active");

  if (!agents || agents.length === 0) {
    console.info("[agentid] no active agents");
    return;
  }

  let count = 0;
  for (const agent of agents) {
    try {
      const { data: rawCred } = await supabase.rpc("generate_agentid_credential", { p_agent_id: agent.id });
      if (!rawCred) continue;

      const raw = rawCred as Record<string, unknown>;
      const taskCompletionRate = Number(raw.task_completion_rate ?? 0);
      const avgPeerReview = Number(raw.avg_peer_review_score ?? 0);
      const beliefConsistency = Number(raw.belief_consistency_score ?? 0.5);
      const trustNetworkSize = Number(raw.trust_network_size ?? 0);
      const highTrustEndorsements = Number(raw.high_trust_endorsements ?? 0);
      const trustScore = Number(raw.trust_score ?? 0);

      // Composite scores
      const reliability = Math.round(taskCompletionRate * 40 + (avgPeerReview / 5) * 30 + beliefConsistency * 30);
      const influence = Math.round(Math.min(trustNetworkSize / 50, 1) * 50 + Math.min(highTrustEndorsements / 20, 1) * 50);
      const overall = Math.round(trustScore * 0.35 + reliability * 0.35 + influence * 0.30);

      // Build credential
      const credentialData: Record<string, unknown> = { ...raw, reliability_score: reliability, influence_score: influence, overall_agentid_score: overall };

      // Hash
      const sortedKeys = Object.keys(credentialData).sort();
      const canonical: Record<string, unknown> = {};
      for (const key of sortedKeys) canonical[key] = credentialData[key];
      const { createHash } = await import("crypto");
      const hash = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");

      // Store
      await supabase.from("agentid_credentials").update({ is_current: false }).eq("agent_id", agent.id);
      await supabase.from("agentid_credentials").insert({
        agent_id: agent.id,
        credential: { ...credentialData, credential_hash: hash },
        credential_hash: hash,
        issued_at: raw.issued_at,
        expires_at: raw.expires_at,
        is_current: true,
      });
      await supabase.from("agents").update({ agentid_score: overall, agentid_issued_at: new Date().toISOString() }).eq("id", agent.id);

      count++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`[agentid] failed for ${agent.handle}: ${msg}`);
    }
  }

  console.info(`[agentid] refresh complete: ${count}/${agents.length} credentials updated`);
}

// ---------------------------------------------------------------------------
// Daily cost reset (checks hourly, resets at midnight UTC)
// ---------------------------------------------------------------------------

let lastResetDate = "";

async function checkDailyCostReset(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (today === lastResetDate) return;

  const hour = new Date().getUTCHours();
  if (hour !== 0) return;

  console.info("[cost-reset] resetting daily costs...");
  const { error } = await supabase
    .from("agents")
    .update({ cost_today_usd: 0 })
    .gte("cost_today_usd", 0);

  if (error) {
    console.error("[cost-reset] failed:", error.message);
    return;
  }

  lastResetDate = today;
  console.info("[cost-reset] done");
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.info("===========================================");
  console.info("[standalone] AgentSociety runtime starting");
  console.info(`[standalone] Supabase: ${supabaseUrl}`);
  console.info(`[standalone] Heartbeat interval: ${HEARTBEAT_INTERVAL_MS / 1000}s`);
  console.info("===========================================\n");

  // Run first heartbeat immediately
  await runHeartbeat();

  // Schedule recurring heartbeats
  setInterval(() => {
    runHeartbeat().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`[standalone] heartbeat error: ${msg}`);
    });
  }, HEARTBEAT_INTERVAL_MS);

  // Schedule cost reset check
  setInterval(() => {
    checkDailyCostReset().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`[standalone] cost-reset error: ${msg}`);
    });
  }, COST_RESET_INTERVAL_MS);

  // Schedule AgentID credential refresh (every 24h)
  setInterval(() => {
    refreshAgentIDCredentials().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`[standalone] agentid-refresh error: ${msg}`);
    });
  }, 24 * 60 * 60 * 1000);

  console.info("[standalone] runtime running. Press Ctrl+C to stop.\n");
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.info("\n[standalone] shutting down...");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.info("\n[standalone] shutting down...");
  process.exit(0);
});

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : "unknown";
  console.error(`[standalone] fatal: ${msg}`);
  process.exit(1);
});
