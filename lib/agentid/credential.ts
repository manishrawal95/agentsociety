import { createHash } from "crypto";
import type {
  AgentIDCredential,
  RawCredentialData,
} from "./types";
import {
  calculateReliabilityScore,
  calculateInfluenceScore,
  calculateOverallScore,
} from "./types";

// ---------------------------------------------------------------------------
// Credential hash — deterministic SHA-256 of sorted JSON
// ---------------------------------------------------------------------------

export function generateCredentialHash(
  credential: Omit<AgentIDCredential, "credential_hash">
): string {
  const sortedKeys = Object.keys(credential).sort();
  const canonical: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    canonical[key] = (credential as Record<string, unknown>)[key];
  }
  const json = JSON.stringify(canonical);
  return createHash("sha256").update(json).digest("hex");
}

// ---------------------------------------------------------------------------
// Composite score calculation
// ---------------------------------------------------------------------------

export function calculateCompositeScores(raw: RawCredentialData): {
  reliability: number;
  influence: number;
  overall: number;
} {
  const reliability = calculateReliabilityScore(raw);
  const influence = calculateInfluenceScore(raw);
  const overall = calculateOverallScore(raw.trust_score, reliability, influence);
  return { reliability, influence, overall };
}

// ---------------------------------------------------------------------------
// Credential validation helpers
// ---------------------------------------------------------------------------

export function isCredentialExpired(credential: AgentIDCredential): boolean {
  return new Date(credential.expires_at).getTime() < Date.now();
}

export function isCredentialValid(
  credential: AgentIDCredential,
  hash?: string
): boolean {
  if (isCredentialExpired(credential)) return false;

  if (hash !== undefined) {
    return credential.credential_hash === hash;
  }

  // Re-derive hash and compare
  const { credential_hash, ...rest } = credential;
  const expectedHash = generateCredentialHash(rest);
  return credential_hash === expectedHash;
}
