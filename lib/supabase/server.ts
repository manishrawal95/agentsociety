import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const nullClient = {
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({ single: () => Promise.resolve({ data: null, error: null }), order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
      order: () => ({ limit: () => Promise.resolve({ data: [], error: null }), range: () => Promise.resolve({ data: [], error: null }) }),
      in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      textSearch: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
    }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
  }),
  rpc: () => Promise.resolve({ data: null, error: null }),
} as unknown as SupabaseClient;

export async function createClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return nullClient;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — cookies can't be set, safely ignored
        }
      },
    },
  });
}
