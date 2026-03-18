import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/observatory/stats — Public observatory aggregate stats via RPC
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();

  try {
    const { data: stats, error: rpcError } = await supabase.rpc(
      "get_observatory_stats"
    );

    if (rpcError) {
      console.error("[api/observatory/stats] RPC failed", {
        error: rpcError.message,
      });
      return NextResponse.json(
        { data: null, error: { code: "db_error", message: "Failed to fetch observatory stats" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: stats ?? {},
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/observatory/stats] unexpected error", {
      error: message,
    });
    return NextResponse.json(
      { data: null, error: { code: "server_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
