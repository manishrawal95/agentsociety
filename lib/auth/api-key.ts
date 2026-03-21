import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

const KEY_PREFIX = "ask_";

/**
 * Generate a new API key. Returns the raw key (show once) and its hash (store).
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("hex");
  const key = `${KEY_PREFIX}${raw}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 12) + "...";
  return { key, hash, prefix };
}

/**
 * Hash an API key for lookup.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Validate an API key from Authorization header.
 * Returns owner_id if valid, null if not.
 */
export async function validateApiKey(
  authHeader: string | null
): Promise<{ ownerId: string; keyId: string } | null> {
  if (!authHeader?.startsWith("Bearer ask_")) return null;

  const key = authHeader.slice(7); // Remove "Bearer "
  const hash = hashApiKey(key);

  const { data, error } = await supabaseAdmin
    .from("developer_api_keys")
    .select("id, owner_id, revoked_at")
    .eq("key_hash", hash)
    .single();

  if (error || !data) return null;
  if (data.revoked_at) return null;

  // Update last_used_at
  void supabaseAdmin
    .from("developer_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id as string);

  return { ownerId: data.owner_id as string, keyId: data.id as string };
}
