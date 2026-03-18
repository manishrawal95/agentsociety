import { MODELS } from './models';
import { ProviderError, type ProviderName, type ProviderRequest, type ProviderResponse, type ModelConfig } from './types';
import { callAnthropic, streamAnthropic } from './anthropic';
import { callOpenAI, streamOpenAI } from './openai';
import { callGoogle, streamGoogle } from './google';
import { callGroq, streamGroq } from './groq';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { MODELS } from './models';
export { ProviderError } from './types';
export type { ProviderName, ProviderRequest, ProviderResponse, ModelConfig, Message } from './types';

// ---------------------------------------------------------------------------
// Model Lookup
// ---------------------------------------------------------------------------

/**
 * Find a model config by provider and model ID.
 * Throws ProviderError if the model is not in the registry.
 */
export function getModelConfig(provider: ProviderName, model: string): ModelConfig {
  const config = MODELS.find((m) => m.provider === provider && m.model === model);
  if (!config) {
    throw new ProviderError(provider, model, `Model "${model}" not found in registry for provider "${provider}"`);
  }
  return config;
}

// ---------------------------------------------------------------------------
// Available Models (filtered by env vars)
// ---------------------------------------------------------------------------

const PROVIDER_ENV_KEYS: Record<ProviderName, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
  groq: 'GROQ_API_KEY',
};

/**
 * Return only models whose provider has an API key set in the environment.
 */
export function listAvailableModels(): ModelConfig[] {
  return MODELS.filter((m) => {
    const envKey = PROVIDER_ENV_KEYS[m.provider];
    return Boolean(process.env[envKey]);
  });
}

// ---------------------------------------------------------------------------
// Cost Calculation
// ---------------------------------------------------------------------------

function calculateCost(tokensIn: number, tokensOut: number, config: ModelConfig): number {
  return (
    (tokensIn / 1000) * config.inputCostPer1kTokens +
    (tokensOut / 1000) * config.outputCostPer1kTokens
  );
}

// ---------------------------------------------------------------------------
// Cost Logging (fire-and-forget)
// ---------------------------------------------------------------------------

function logCost(
  agentId: string,
  provider: ProviderName,
  model: string,
  tokensIn: number,
  tokensOut: number,
  costUsd: number,
): void {
  void supabaseAdmin
    .from('cost_log')
    .insert({
      agent_id: agentId,
      provider,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      job_type: 'reasoning',
    })
    .then(({ error }) => {
      if (error) {
        console.error(`[providers] Failed to log cost: ${error.message}`);
      }
    });
}

// ---------------------------------------------------------------------------
// generateResponse — unified call across all providers
// ---------------------------------------------------------------------------

export async function generateResponse(req: ProviderRequest): Promise<ProviderResponse> {
  const config = getModelConfig(req.provider, req.model);
  const startMs = Date.now();

  let result: { content: string; tokensIn: number; tokensOut: number };

  switch (req.provider) {
    case 'anthropic':
      result = await callAnthropic(req);
      break;
    case 'openai':
      result = await callOpenAI(req);
      break;
    case 'google':
      result = await callGoogle(req);
      break;
    case 'groq':
      result = await callGroq(req);
      break;
    default: {
      const _exhaustive: never = req.provider;
      throw new ProviderError(_exhaustive, req.model, `Unknown provider: ${String(_exhaustive)}`);
    }
  }

  const durationMs = Date.now() - startMs;
  const costUsd = calculateCost(result.tokensIn, result.tokensOut, config);

  // Log token usage (never prompt content)
  console.info(
    `[providers] provider=${req.provider} model=${req.model} tokens_in=${result.tokensIn} tokens_out=${result.tokensOut} cost_usd=${costUsd.toFixed(6)} duration_ms=${durationMs}`,
  );

  // Fire-and-forget cost logging when agentId is provided
  if (req.agentId) {
    logCost(req.agentId, req.provider, req.model, result.tokensIn, result.tokensOut, costUsd);
  }

  return {
    content: result.content,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd,
    provider: req.provider,
    model: req.model,
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// streamResponse — unified streaming across all providers
// ---------------------------------------------------------------------------

export async function* streamResponse(req: ProviderRequest): AsyncGenerator<string> {
  const config = getModelConfig(req.provider, req.model);

  if (!config.supportsStreaming) {
    throw new ProviderError(
      req.provider,
      req.model,
      `Model "${req.model}" does not support streaming. Use generateResponse() instead.`,
    );
  }

  let generator: AsyncGenerator<string>;

  switch (req.provider) {
    case 'anthropic':
      generator = streamAnthropic(req);
      break;
    case 'openai':
      generator = streamOpenAI(req);
      break;
    case 'google':
      generator = streamGoogle(req);
      break;
    case 'groq':
      generator = streamGroq(req);
      break;
    default: {
      const _exhaustive: never = req.provider;
      throw new ProviderError(_exhaustive, req.model, `Unknown provider: ${String(_exhaustive)}`);
    }
  }

  // Accumulate output for cost logging after stream completes
  let totalChars = 0;
  const startMs = Date.now();

  try {
    for await (const chunk of generator) {
      totalChars += chunk.length;
      yield chunk;
    }
  } finally {
    const durationMs = Date.now() - startMs;
    // Estimate tokens from character count (rough: ~4 chars per token)
    const estimatedTokensOut = Math.ceil(totalChars / 4);
    // Input tokens are not available during streaming — estimate from message length
    const inputChars = req.messages.reduce((sum, m) => sum + m.content.length, 0) + (req.systemPrompt?.length ?? 0);
    const estimatedTokensIn = Math.ceil(inputChars / 4);
    const costUsd = calculateCost(estimatedTokensIn, estimatedTokensOut, config);

    console.info(
      `[providers:stream] provider=${req.provider} model=${req.model} est_tokens_in=${estimatedTokensIn} est_tokens_out=${estimatedTokensOut} cost_usd=${costUsd.toFixed(6)} duration_ms=${durationMs}`,
    );

    if (req.agentId) {
      logCost(req.agentId, req.provider, req.model, estimatedTokensIn, estimatedTokensOut, costUsd);
    }
  }
}
