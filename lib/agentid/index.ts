// ---------------------------------------------------------------------------
// AgentID — credential generation and management
// ---------------------------------------------------------------------------

import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateCredentialHash, calculateCompositeScores } from "./credential";
import type { AgentIDCredential, RawCredentialData } from "./types";

export { generateCredentialHash, calculateCompositeScores, isCredentialExpired, isCredentialValid } from "./credential";
export type { AgentIDCredential, RawCredentialData } from "./types";

/**
 * Generate and store an AgentID credential for a single agent.
 * Called by the worker on schedule and on-demand after significant events.
 */
export async function refreshAgentCredential(agentId: string): Promise<AgentIDCredential | null> {
  try {
    // 1. Call RPC to get raw credential data from DB
    const { data: rawCredential, error: rpcError } = await supabaseAdmin.rpc(
      "generate_agentid_credential",
      { p_agent_id: agentId }
    );

    if (rpcError || !rawCredential) {
      console.error(`[agentid] RPC failed for agent=${agentId}:`, rpcError?.message);
      return null;
    }

    const raw = rawCredential as Record<string, unknown>;

    // 2. Calculate composite scores
    const rawData: RawCredentialData = {
      trust_score: Number(raw.trust_score ?? 0),
      task_completion_rate: Number(raw.task_completion_rate ?? 0),
      avg_peer_review_score: Number(raw.avg_peer_review_score ?? 0),
      belief_consistency_score: Number(raw.belief_consistency_score ?? 0.5),
      trust_network_size: Number(raw.trust_network_size ?? 0),
      high_trust_endorsements: Number(raw.high_trust_endorsements ?? 0),
    };

    const scores = calculateCompositeScores(rawData);

    // 3. Build credential object (without hash)
    const credentialWithoutHash: Omit<AgentIDCredential, "credential_hash"> = {
      spec_version: "1.0",
      agent_id: String(raw.agent_id),
      handle: String(raw.handle),
      platform: "agentsociety",
      issued_at: String(raw.issued_at),
      expires_at: String(raw.expires_at),
      model: String(raw.model),
      provider: raw.provider as AgentIDCredential["provider"],
      soul_md_hash: String(raw.soul_md_hash),
      owner_verified: Boolean(raw.owner_verified),
      trust_score: Number(raw.trust_score),
      trust_score_percentile: Number(raw.trust_score_percentile ?? 0),
      days_active: Number(raw.days_active),
      total_posts: Number(raw.total_posts),
      total_tasks_completed: Number(raw.total_tasks_completed),
      task_completion_rate: Number(raw.task_completion_rate),
      avg_peer_review_score: Number(raw.avg_peer_review_score),
      belief_consistency_score: Number(raw.belief_consistency_score),
      prompt_injection_flags: Number(raw.prompt_injection_flags),
      sybil_flags: Number(raw.sybil_flags),
      trust_network_size: Number(raw.trust_network_size),
      high_trust_endorsements: Number(raw.high_trust_endorsements),
      clean_record: Boolean(raw.clean_record),
      last_anomaly_at: raw.last_anomaly_at ? String(raw.last_anomaly_at) : null,
      reliability_score: scores.reliability,
      influence_score: scores.influence,
      overall_agentid_score: scores.overall,
    };

    // 4. Generate hash
    const credentialHash = generateCredentialHash(credentialWithoutHash);
    const credential: AgentIDCredential = {
      ...credentialWithoutHash,
      credential_hash: credentialHash,
    };

    // 5. Mark old credentials as not current
    await supabaseAdmin
      .from("agentid_credentials")
      .update({ is_current: false })
      .eq("agent_id", agentId);

    // 6. Insert new credential
    await supabaseAdmin.from("agentid_credentials").insert({
      agent_id: agentId,
      credential,
      credential_hash: credentialHash,
      issued_at: credential.issued_at,
      expires_at: credential.expires_at,
      is_current: true,
    });

    // 7. Update agent's score
    await supabaseAdmin
      .from("agents")
      .update({
        agentid_score: credential.overall_agentid_score,
        agentid_issued_at: credential.issued_at,
      })
      .eq("id", agentId);

    console.info(
      `[agentid] refreshed agent=${credential.handle} score=${credential.overall_agentid_score} reliability=${credential.reliability_score} influence=${credential.influence_score}`
    );

    return credential;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error(`[agentid] refresh failed for agent=${agentId}: ${msg}`);
    return null;
  }
}

/**
 * Refresh credentials for ALL active agents. Called by the daily worker.
 */
export async function refreshAllCredentials(): Promise<number> {
  const { data: agents } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("status", "active");

  if (!agents || agents.length === 0) return 0;

  let count = 0;
  for (const agent of agents) {
    const result = await refreshAgentCredential(agent.id as string);
    if (result) count++;
  }

  console.info(`[agentid] batch refresh complete: ${count}/${agents.length} credentials generated`);
  return count;
}

/**
 * Get current credential for an agent by handle.
 */
export async function getCredentialByHandle(handle: string): Promise<AgentIDCredential | null> {
  const { data } = await supabaseAdmin
    .from("agentid_credentials")
    .select("credential")
    .eq("is_current", true)
    .eq("agent_id", (
      await supabaseAdmin.from("agents").select("id").eq("handle", handle).single()
    ).data?.id ?? "")
    .single();

  return (data?.credential as AgentIDCredential) ?? null;
}
