import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetStatus {
  withinBudget: boolean;
  remaining: number;
  used: number;
  limit: number;
}

interface CostLogEntry {
  agentId: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  jobType: string;
}

export type { BudgetStatus, CostLogEntry };

// ---------------------------------------------------------------------------
// checkBudget — returns whether agent is within daily budget
// ---------------------------------------------------------------------------

export async function checkBudget(agentId: string): Promise<BudgetStatus> {
  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("cost_today_usd, daily_budget_usd")
    .eq("id", agentId)
    .single();

  if (error || !agent) {
    console.error(
      `[cost-controller] checkBudget failed for agent=${agentId}:`,
      error?.message ?? "agent not found"
    );
    // Fail safe — deny budget if we can't check
    return { withinBudget: false, remaining: 0, used: 0, limit: 0 };
  }

  const used = Number(agent.cost_today_usd) || 0;
  const limit = Number(agent.daily_budget_usd) || 0;
  const remaining = Math.max(0, limit - used);

  return {
    withinBudget: used < limit,
    remaining,
    used,
    limit,
  };
}

// ---------------------------------------------------------------------------
// logCost — records a cost event and updates the agent's running total
// ---------------------------------------------------------------------------

export async function logCost(entry: CostLogEntry): Promise<void> {
  const { agentId, tokensIn, tokensOut, costUsd, jobType } = entry;

  // Insert into cost_log
  const { error: logError } = await supabaseAdmin.from("cost_log").insert({
    agent_id: agentId,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: costUsd,
    job_type: jobType,
    created_at: new Date().toISOString(),
  });

  if (logError) {
    console.error(
      `[cost-controller] logCost insert failed for agent=${agentId}:`,
      logError.message
    );
  }

  // Increment agent's daily cost using RPC or manual read-then-write
  const { data: agent, error: fetchError } = await supabaseAdmin
    .from("agents")
    .select("cost_today_usd")
    .eq("id", agentId)
    .single();

  if (fetchError || !agent) {
    console.error(
      `[cost-controller] could not fetch agent=${agentId} to update cost:`,
      fetchError?.message ?? "not found"
    );
    return;
  }

  const newCost = (Number(agent.cost_today_usd) || 0) + costUsd;

  const { error: updateError } = await supabaseAdmin
    .from("agents")
    .update({ cost_today_usd: newCost })
    .eq("id", agentId);

  if (updateError) {
    console.error(
      `[cost-controller] cost update failed for agent=${agentId}:`,
      updateError.message
    );
  }

  console.info(
    `[cost-controller] agent=${agentId} job=${jobType} cost=${costUsd.toFixed(6)} total_today=${newCost.toFixed(6)}`
  );
}

// ---------------------------------------------------------------------------
// resetDailyCosts — zero out all agents' daily cost (run once per day)
// ---------------------------------------------------------------------------

export async function resetDailyCosts(): Promise<void> {
  const { error } = await supabaseAdmin
    .from("agents")
    .update({ cost_today_usd: 0 })
    .gte("cost_today_usd", 0); // matches all rows (Supabase requires a filter)

  if (error) {
    console.error("[cost-controller] resetDailyCosts failed:", error.message);
    return;
  }

  console.info("[cost-controller] daily costs reset for all agents");
}

// ---------------------------------------------------------------------------
// pauseOverBudgetAgents — pause any agent that has exceeded their budget
// ---------------------------------------------------------------------------

export async function pauseOverBudgetAgents(): Promise<void> {
  // Fetch agents that are active and over budget
  const { data: agents, error: fetchError } = await supabaseAdmin
    .from("agents")
    .select("id, cost_today_usd, daily_budget_usd")
    .eq("status", "active");

  if (fetchError) {
    console.error(
      "[cost-controller] pauseOverBudgetAgents fetch failed:",
      fetchError.message
    );
    return;
  }

  if (!agents || agents.length === 0) return;

  const overBudgetIds = agents
    .filter(
      (a) =>
        (Number(a.cost_today_usd) || 0) >= (Number(a.daily_budget_usd) || 0)
    )
    .map((a) => a.id as string);

  if (overBudgetIds.length === 0) return;

  const { error: updateError } = await supabaseAdmin
    .from("agents")
    .update({ status: "paused" })
    .in("id", overBudgetIds);

  if (updateError) {
    console.error(
      "[cost-controller] pauseOverBudgetAgents update failed:",
      updateError.message
    );
    return;
  }

  console.warn(
    `[cost-controller] paused ${overBudgetIds.length} over-budget agents: ${overBudgetIds.join(", ")}`
  );
}
