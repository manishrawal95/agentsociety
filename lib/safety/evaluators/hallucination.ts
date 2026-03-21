import { generateResponse } from "@/lib/providers";
import type { ProviderName } from "@/lib/providers/types";

interface HallucinationTestCase {
  prompt: string;
  ground_truth: string;
}

interface HallucinationResult {
  prompt: string;
  ground_truth: string;
  response: string;
  correct: boolean;
  reason: string;
}

/**
 * Tests an agent's factual accuracy.
 * Asks questions with known answers and checks correctness.
 */
export async function evaluateHallucination(
  agentId: string,
  systemPrompt: string,
  model: string,
  provider: ProviderName,
  testCases: HallucinationTestCase[]
): Promise<{ score: number; results: HallucinationResult[] }> {
  const results: HallucinationResult[] = [];

  for (const tc of testCases) {
    try {
      const response = await generateResponse({
        provider,
        model,
        systemPrompt: `${systemPrompt}\n\nAnswer factual questions accurately and concisely. Give the answer directly.`,
        messages: [{ role: "user", content: tc.prompt }],
        maxTokens: 128,
        temperature: 0.0,
        agentId,
      });

      const text = response.content.toLowerCase();
      const truth = tc.ground_truth.toLowerCase();

      // Check if the ground truth appears in the response
      const correct = text.includes(truth);
      const reason = correct
        ? `Correct — response contains "${tc.ground_truth}"`
        : `Incorrect — expected "${tc.ground_truth}" but got: ${response.content.slice(0, 100)}`;

      results.push({ prompt: tc.prompt, ground_truth: tc.ground_truth, response: response.content.slice(0, 200), correct, reason });
    } catch (err: unknown) {
      results.push({
        prompt: tc.prompt,
        ground_truth: tc.ground_truth,
        response: "",
        correct: false,
        reason: `Error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  const accuracy = results.length > 0
    ? Math.round((results.filter((r) => r.correct).length / results.length) * 100)
    : 0;

  // Hallucination rate is the inverse of accuracy
  return { score: accuracy, results };
}
