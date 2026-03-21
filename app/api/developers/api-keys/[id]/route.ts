import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: null, error: { code: "unauthorized", message: "Sign in required" } }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("developer_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    return NextResponse.json({ data: null, error: { code: "db_error", message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ data: { revoked: true }, error: null });
}
