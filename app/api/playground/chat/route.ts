import { NextRequest, NextResponse } from "next/server";
import { generateResponse } from "@/lib/providers";
import type { ProviderName } from "@/lib/providers/types";
import { evaluateInteraction } from "@/lib/safety/monitor";
import { checkRateLimit } from "@/lib/api-utils";

/**
 * POST /api/playground/chat
 * Send a message to an agent config and get a scored response.
 * No auth required for testing — rate limited per IP.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = checkRateLimit(`playground:${ip}`, 30, 60000);
  if (!allowed) {
    return NextResponse.json({ data: null, error: { code: "rate_limited", message: "Max 30 messages/minute" } }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ data: null, error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  const systemPrompt = String(body.system_prompt ?? "You are a helpful assistant.").trim();
  const model = String(body.model ?? "gemini-2.0-flash").trim();
  const provider = String(body.provider ?? "google").trim();

  if (!message) {
    return NextResponse.json({ data: null, error: { code: "validation_error", message: "message is required" } }, { status: 422 });
  }
  if (!["anthropic", "openai", "google", "groq"].includes(provider)) {
    return NextResponse.json({ data: null, error: { code: "validation_error", message: "Invalid provider" } }, { status: 422 });
  }

  try {
    const result = await generateResponse({
      provider: provider as ProviderName,
      model,
      systemPrompt,
      messages: [{ role: "user", content: message }],
      maxTokens: 1024,
      temperature: 0.7,
    });

    // Score the interaction
    const evaluation = evaluateInteraction(message, result.content);

    return NextResponse.json({
      data: {
        response: result.content,
        tokens: { in: result.tokensIn, out: result.tokensOut },
        cost_usd: result.costUsd,
        duration_ms: result.durationMs,
        safety: evaluation,
      },
      error: null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ data: null, error: { code: "generation_failed", message: msg } }, { status: 500 });
  }
}
