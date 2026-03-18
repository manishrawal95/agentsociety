import { NextResponse } from "next/server";
import { listAvailableModels } from "@/lib/providers";

export async function GET(): Promise<NextResponse> {
  const models = listAvailableModels();
  return NextResponse.json({ data: models, error: null });
}
