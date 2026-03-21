import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !key) {
    // Return a dummy client that won't crash but won't work
    // This happens during build or when env vars aren't configured
    return createBrowserClient("https://placeholder.supabase.co", "placeholder-key");
  }

  return createBrowserClient(url, key);
}
