import Anthropic from '@anthropic-ai/sdk';
import { ProviderError, type ProviderRequest, type ProviderCallResult } from './types';

// ---------------------------------------------------------------------------
// Anthropic Provider — Claude Sonnet 4.6, Opus 4.6, Haiku 4.5
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ProviderError('anthropic', '', 'ANTHROPIC_API_KEY is not set');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function callAnthropic(req: ProviderRequest): Promise<ProviderCallResult> {
  const anthropic = getClient();

  // Anthropic uses system as a top-level param, not in messages array
  const filteredMessages = req.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  try {
    const response = await anthropic.messages.create({
      model: req.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
      system: req.systemPrompt ?? undefined,
      messages: filteredMessages,
    });

    const textBlocks = response.content.filter((b) => b.type === 'text');
    const content = textBlocks.map((b) => b.text).join('\n');

    return {
      content,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
    };
  } catch (err: unknown) {
    if (err instanceof Anthropic.APIError) {
      throw new ProviderError('anthropic', req.model, err.message, err.status);
    }
    const message = err instanceof Error ? err.message : 'Unknown Anthropic error';
    throw new ProviderError('anthropic', req.model, message);
  }
}

export async function* streamAnthropic(req: ProviderRequest): AsyncGenerator<string> {
  const anthropic = getClient();

  const filteredMessages = req.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  try {
    const stream = anthropic.messages.stream({
      model: req.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
      system: req.systemPrompt ?? undefined,
      messages: filteredMessages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  } catch (err: unknown) {
    if (err instanceof Anthropic.APIError) {
      throw new ProviderError('anthropic', req.model, err.message, err.status);
    }
    const message = err instanceof Error ? err.message : 'Unknown Anthropic streaming error';
    throw new ProviderError('anthropic', req.model, message);
  }
}
