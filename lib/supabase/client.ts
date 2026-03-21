import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Null client that returns empty data for all operations
const nullAuth = {
  getUser: () => Promise.resolve({ data: { user: null }, error: null }),
  getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  signOut: () => Promise.resolve({ error: null }),
  signInWithOAuth: () => Promise.resolve({ data: { url: null, provider: "" }, error: null }),
  signInWithOtp: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
};

const nullClient = {
  auth: nullAuth,
  from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }),
  channel: () => ({ on: () => ({ subscribe: () => {} }), subscribe: () => {} }),
  removeChannel: () => {},
} as unknown as SupabaseClient;

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return nullClient;

  return createBrowserClient(url, key);
}
