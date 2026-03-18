import type { ModelConfig } from './types';

// ---------------------------------------------------------------------------
// Model Registry — all supported models with pricing and capabilities
// ---------------------------------------------------------------------------

export const MODELS: ModelConfig[] = [
  // Anthropic
  { provider: 'anthropic', model: 'claude-sonnet-4-6',         displayName: 'Claude Sonnet 4.6', contextWindow: 200000,  inputCostPer1kTokens: 0.003,   outputCostPer1kTokens: 0.015,   supportsStreaming: true,  maxOutputTokens: 8192  },
  { provider: 'anthropic', model: 'claude-opus-4-6',           displayName: 'Claude Opus 4.6',   contextWindow: 200000,  inputCostPer1kTokens: 0.015,   outputCostPer1kTokens: 0.075,   supportsStreaming: true,  maxOutputTokens: 8192  },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5',  contextWindow: 200000,  inputCostPer1kTokens: 0.00025, outputCostPer1kTokens: 0.00125, supportsStreaming: true,  maxOutputTokens: 8192  },
  // OpenAI
  { provider: 'openai', model: 'gpt-4o',      displayName: 'GPT-4o',      contextWindow: 128000, inputCostPer1kTokens: 0.005,   outputCostPer1kTokens: 0.015,  supportsStreaming: true,  maxOutputTokens: 16384 },
  { provider: 'openai', model: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextWindow: 128000, inputCostPer1kTokens: 0.00015, outputCostPer1kTokens: 0.0006, supportsStreaming: true,  maxOutputTokens: 16384 },
  { provider: 'openai', model: 'o1-mini',     displayName: 'o1 Mini',     contextWindow: 128000, inputCostPer1kTokens: 0.003,   outputCostPer1kTokens: 0.012,  supportsStreaming: false, maxOutputTokens: 65536 },
  // Google
  { provider: 'google', model: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', contextWindow: 1000000, inputCostPer1kTokens: 0.00010, outputCostPer1kTokens: 0.00040, supportsStreaming: true, maxOutputTokens: 8192 },
  { provider: 'google', model: 'gemini-1.5-pro',   displayName: 'Gemini 1.5 Pro',   contextWindow: 2000000, inputCostPer1kTokens: 0.00125, outputCostPer1kTokens: 0.005,   supportsStreaming: true, maxOutputTokens: 8192 },
  // Groq
  { provider: 'groq', model: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B', contextWindow: 128000, inputCostPer1kTokens: 0.00059, outputCostPer1kTokens: 0.00079, supportsStreaming: true, maxOutputTokens: 32768 },
  { provider: 'groq', model: 'mixtral-8x7b-32768',      displayName: 'Mixtral 8x7B',  contextWindow: 32768,  inputCostPer1kTokens: 0.00024, outputCostPer1kTokens: 0.00024, supportsStreaming: true, maxOutputTokens: 32768 },
  { provider: 'groq', model: 'gemma2-9b-it',            displayName: 'Gemma 2 9B',    contextWindow: 8192,   inputCostPer1kTokens: 0.00020, outputCostPer1kTokens: 0.00020, supportsStreaming: true, maxOutputTokens: 8192  },
];
