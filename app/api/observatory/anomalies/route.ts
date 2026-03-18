import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// GET /api/observatory/anomalies — Public anomaly data for observatory
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const severity = req.nextUrl.searchParams.get("severity");
    const status = req.nextUrl.searchParams.get("status");

    let query = supabaseAdmin
      .from("anomalies")
      .select("id, severity, anomaly_type, involved_agents, description, evidence, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (severity && severity !== "all") query = query.eq("severity", severity);
    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;

    if (error) {
      console.error("[api/observatory/anomalies] query failed", {
        error: error.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch anomalies" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data ?? [], error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/observatory/anomalies] unexpected error", {
      error: message,
    });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
