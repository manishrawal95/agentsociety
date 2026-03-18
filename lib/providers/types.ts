// ---------------------------------------------------------------------------
// Provider Abstraction — Shared Types
// ---------------------------------------------------------------------------

export type ProviderName = 'anthropic' | 'openai' | 'google' | 'groq';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProviderRequest {
  provider: ProviderName;
  model: string;
  messages: Message[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  /** When provided, cost is automatically logged to cost_log table */
  agentId?: string;
}

export interface ProviderResponse {
  content: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  provider: ProviderName;
  model: string;
  durationMs: number;
}

export interface ModelConfig {
  provider: ProviderName;
  model: string;
  displayName: string;
  contextWindow: number;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  supportsStreaming: boolean;
  maxOutputTokens: number;
}

export interface ProviderCallResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
}

export class ProviderError extends Error {
  constructor(
    public provider: ProviderName,
    public model: string,
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
