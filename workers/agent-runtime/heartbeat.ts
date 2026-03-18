import { type Job } from "bullmq";
import { createWorker, heartbeatQueue, reasoningQueue } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkBudget } from "./cost-controller";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeartbeatJobData {
  agentId: string;
}

interface AgentRow {
  id: string;
  status: string;
  cost_today_usd: number;
  daily_budget_usd: number;
}

// ---------------------------------------------------------------------------
// Heartbeat processor
// ---------------------------------------------------------------------------

async function processHeartbeat(
  job: Job<HeartbeatJobData>
): Promise<void> {
  const { agentId } = job.data;

  console.info(`[heartbeat] processing agent=${agentId} job=${job.id}`);

  // 1. Fetch agent from DB
  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("id, status, cost_today_usd, daily_budget_usd")
    .eq("id", agentId)
    .single<AgentRow>();

  if (error || !agent) {
    console.error(
      `[heartbeat] agent=${agentId} not found:`,
      error?.message ?? "no data"
    );
    return;
  }

  // 2. Skip if not active
  if (agent.status !== "active") {
    console.info(
      `[heartbeat] agent=${agentId} status=${agent.status} — skipping`
    );
    return;
  }

  // 3. Check budget
  const budget = await checkBudget(agentId);
  if (!budget.withinBudget) {
    console.warn(
      `[heartbeat] agent=${agentId} over budget (${budget.used.toFixed(4)}/${budget.limit.toFixed(4)}) — pausing`
    );

    const { error: pauseError } = await supabaseAdmin
      .from("agents")
      .update({ status: "paused" })
      .eq("id", agentId);

    if (pauseError) {
      console.error(
        `[heartbeat] failed to pause agent=${agentId}:`,
        pauseError.message
      );
    }
    return;
  }

  // 4. Update last_heartbeat_at
  const { error: updateError } = await supabaseAdmin
    .from("agents")
    .update({ last_heartbeat_at: new Date().toISOString() })
    .eq("id", agentId);

  if (updateError) {
    console.error(
      `[heartbeat] failed to update heartbeat for agent=${agentId}:`,
      updateError.message
    );
  }

  // 5. Enqueue reasoning job
  await reasoningQueue.add(
    `reasoning:${agentId}`,
    { agentId, trigger: "heartbeat" as const },
    {
      jobId: `reasoning:${agentId}:${Date.now()}`,
      removeOnComplete: true,
    }
  );

  console.info(
    `[heartbeat] agent=${agentId} heartbeat recorded, reasoning job enqueued`
  );
}

// ---------------------------------------------------------------------------
// startHeartbeatScheduler — registers repeatable jobs for all active agents
// ---------------------------------------------------------------------------

export async function startHeartbeatScheduler() {
  // Fetch all active agents
  const { data: agents, error } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("status", "active");

  if (error) {
    console.error(
      "[heartbeat] failed to fetch active agents:",
      error.message
    );
    throw error;
  }

  if (!agents || agents.length === 0) {
    console.info("[heartbeat] no active agents found — scheduler idle");
  } else {
    // Add repeatable jobs for each active agent (every 5 minutes)
    for (const agent of agents) {
      const agentId = agent.id as string;

      await heartbeatQueue.upsertJobScheduler(
        `heartbeat:${agentId}`,
        { every: 5 * 60 * 1000 }, // 5 minutes
        {
          name: `heartbeat:${agentId}`,
          data: { agentId },
        }
      );

      console.info(`[heartbeat] scheduled repeatable job for agent=${agentId}`);
    }
  }

  // Start the worker
  const worker = createWorker<HeartbeatJobData>(
    "agent:heartbeat",
    processHeartbeat
  );

  console.info("[heartbeat] worker started");
  return worker;
}
