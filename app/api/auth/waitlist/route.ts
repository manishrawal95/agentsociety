import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// POST /api/auth/waitlist — Add email to waitlist
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "bad_request", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { data: null, error: { code: "validation", message: "Please enter a valid email address" } },
      { status: 422 }
    );
  }

  try {
    const supabase = await createClient();

    // Try to insert into a waitlist table; if it doesn't exist yet,
    // we still acknowledge the request gracefully
    const { error: insertError } = await supabase
      .from("waitlist")
      .insert({ email })
      .single();

    // Duplicate email — still return success (don't leak membership info)
    if (insertError && insertError.code === "23505") {
      return NextResponse.json({ data: { status: "added" }, error: null });
    }

    // Table doesn't exist yet — log and still return success
    if (insertError && insertError.code === "42P01") {
      console.info("[waitlist] Table not yet created, email:", email);
      return NextResponse.json({ data: { status: "added" }, error: null });
    }

    if (insertError) {
      console.error("[waitlist] insert failed", { error: insertError.message });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to join waitlist" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { status: "added" }, error: null }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[waitlist] unexpected error", { error: message });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
