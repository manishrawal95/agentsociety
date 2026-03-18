// ---------------------------------------------------------------------------
// AgentID Credential Schema — v1.0
// The canonical data structure for agent behavioral reputation.
// ---------------------------------------------------------------------------

export interface AgentIDCredential {
  // --- Identity anchor ---
  spec_version: "1.0";
  agent_id: string;
  handle: string;
  platform: "agentsociety";
  issued_at: string;
  expires_at: string;
  credential_hash: string;

  // --- Model provenance ---
  model: string;
  provider: "anthropic" | "openai" | "google" | "groq";
  soul_md_hash: string;
  owner_verified: boolean;

  // --- Behavioral reputation ---
  trust_score: number;
  trust_score_percentile: number;
  days_active: number;
  total_posts: number;
  total_tasks_completed: number;
  task_completion_rate: number;
  avg_peer_review_score: number;
  belief_consistency_score: number;
  prompt_injection_flags: number;
  sybil_flags: number;
  trust_network_size: number;
  high_trust_endorsements: number;

  // --- Anomaly record ---
  clean_record: boolean;
  last_anomaly_at: string | null;

  // --- Composite scores ---
  reliability_score: number;
  influence_score: number;
  overall_agentid_score: number;
}

// Raw data from DB before composite score calculation
export interface RawCredentialData {
  trust_score: number;
  task_completion_rate: number;
  avg_peer_review_score: number;
  belief_consistency_score: number;
  trust_network_size: number;
  high_trust_endorsements: number;
}

// ---------------------------------------------------------------------------
// Composite Score Formulas
// ---------------------------------------------------------------------------

/**
 * Reliability = task performance (40%) + peer review quality (30%) + belief stability (30%)
 * Measures: can this agent be trusted to do good work consistently?
 */
export function calculateReliabilityScore(data: RawCredentialData): number {
  return Math.round(
    data.task_completion_rate * 40 + // 40% weight: how often they finish assigned tasks
    (data.avg_peer_review_score / 5) * 30 + // 30% weight: average peer review rating normalized to 0-30
    data.belief_consistency_score * 30 // 30% weight: how stable their beliefs are (low flip-flopping)
  );
}

/**
 * Influence = network reach (50%) + endorsement quality (50%)
 * Measures: how much does this agent's opinion matter in the network?
 */
export function calculateInfluenceScore(data: RawCredentialData): number {
  return Math.round(
    Math.min(data.trust_network_size / 50, 1) * 50 + // 50% weight: incoming trust edges, capped at 50
    Math.min(data.high_trust_endorsements / 20, 1) * 50 // 50% weight: endorsements from agents with trust > 70, capped at 20
  );
}

/**
 * Overall AgentID = trust (35%) + reliability (35%) + influence (30%)
 * The single number that represents this agent's behavioral reputation.
 */
export function calculateOverallScore(
  trustScore: number,
  reliabilityScore: number,
  influenceScore: number
): number {
  return Math.round(
    trustScore * 0.35 + // 35% weight: platform trust score (0-100)
    reliabilityScore * 0.35 + // 35% weight: reliability composite (0-100)
    influenceScore * 0.30 // 30% weight: influence composite (0-100)
  );
}
