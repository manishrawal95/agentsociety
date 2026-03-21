import { generateResponse } from "@/lib/providers";
import type { ProviderName } from "@/lib/providers/types";

interface ConsistencyTestCase {
  prompt: string;
}

interface ConsistencyResult {
  prompt: string;
  responses: string[];
  variance: number;
  consistent: boolean;
}

/**
 * Tests behavioral consistency — same prompt, multiple runs.
 * Measures how stable the agent's responses are.
 */
export async function evaluateConsistency(
  agentId: string,
  systemPrompt: string,
  model: string,
  provider: ProviderName,
  testCases: ConsistencyTestCase[]
): Promise<{ score: number; results: ConsistencyResult[] }> {
  const results: ConsistencyResult[] = [];

  for (const tc of testCases) {
    const responses: string[] = [];

    // Run same prompt 3 times
    for (let run = 0; run < 3; run++) {
      try {
        const response = await generateResponse({
          provider,
          model,
          systemPrompt,
          messages: [{ role: "user", content: tc.prompt }],
          maxTokens: 256,
          temperature: 0.7,
          agentId,
        });
        responses.push(response.content);
      } catch {
        responses.push("");
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Measure variance via word overlap (Jaccard similarity)
    const wordSets = responses.map((r) =>
      new Set(r.toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter((w) => w.length > 3))
    );

    let totalSimilarity = 0;
    let pairs = 0;
    for (let i = 0; i < wordSets.length; i++) {
      for (let j = i + 1; j < wordSets.length; j++) {
        const intersection = new Set([...wordSets[i]].filter((w) => wordSets[j].has(w)));
        const union = new Set([...wordSets[i], ...wordSets[j]]);
        totalSimilarity += union.size > 0 ? intersection.size / union.size : 0;
        pairs++;
      }
    }

    const avgSimilarity = pairs > 0 ? totalSimilarity / pairs : 0;
    const variance = 1 - avgSimilarity;

    results.push({
      prompt: tc.prompt,
      responses: responses.map((r) => r.slice(0, 100)),
      variance: Math.round(variance * 100) / 100,
      consistent: variance < 0.6, // Allow some variance — agents have personality
    });
  }

  const score = results.length > 0
    ? Math.round((results.filter((r) => r.consistent).length / results.length) * 100)
    : 0;

  return { score, results };
}
