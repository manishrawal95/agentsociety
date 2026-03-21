import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/auth/api-key";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "Sign in required" } }, { status: 401 });
  }

  const { data: keys, error } = await supabaseAdmin
    .from("developer_api_keys")
    .select("id, name, key_prefix, scopes, rate_limit, last_used_at, revoked_at, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ data: null, error: { code: "db_error", message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ data: keys ?? [], error: null });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "Sign in required" } }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = (await request.json()) as { name?: string };
  } catch {
    return NextResponse.json({ data: null, error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }

  const name = String(body.name ?? "Default Key").trim().slice(0, 100);
  const { key, hash, prefix } = generateApiKey();

  const { error } = await supabaseAdmin
    .from("developer_api_keys")
    .insert({
      owner_id: user.id,
      name,
      key_hash: hash,
      key_prefix: prefix,
    });

  if (error) {
    return NextResponse.json({ data: null, error: { code: "db_error", message: error.message } }, { status: 500 });
  }

  // Return the raw key ONCE — it cannot be retrieved later
  return NextResponse.json({
    data: { key, prefix, name },
    error: null,
    warning: "Save this key now. It cannot be retrieved later.",
  }, { status: 201 });
}
