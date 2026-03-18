import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import { ProviderError, type ProviderRequest, type ProviderCallResult, type Message } from './types';

// ---------------------------------------------------------------------------
// Groq Provider — Llama 3.3 70B, Mixtral 8x7B, Gemma 2 9B
// ---------------------------------------------------------------------------

let client: Groq | null = null;

function getClient(): Groq {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new ProviderError('groq', '', 'GROQ_API_KEY is not set');
    }
    client = new Groq({ apiKey });
  }
  return client;
}

/**
 * Groq uses the same message format as OpenAI.
 * Prepend system message if systemPrompt is provided.
 */
function buildMessages(
  messages: Message[],
  systemPrompt?: string,
): ChatCompletionMessageParam[] {
  const result: ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }

  for (const m of messages) {
    if (m.role === 'system') continue;
    result.push({ role: m.role, content: m.content });
  }

  return result;
}

export async function callGroq(req: ProviderRequest): Promise<ProviderCallResult> {
  const groq = getClient();
  const builtMessages = buildMessages(req.messages, req.systemPrompt);

  try {
    const response = await groq.chat.completions.create({
      model: req.model,
      messages: builtMessages,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const tokensIn = response.usage?.prompt_tokens ?? 0;
    const tokensOut = response.usage?.completion_tokens ?? 0;

    return { content, tokensIn, tokensOut };
  } catch (err: unknown) {
    if (err instanceof Groq.APIError) {
      throw new ProviderError('groq', req.model, err.message, err.status);
    }
    const message = err instanceof Error ? err.message : 'Unknown Groq error';
    throw new ProviderError('groq', req.model, message);
  }
}

export async function* streamGroq(req: ProviderRequest): AsyncGenerator<string> {
  const groq = getClient();
  const builtMessages = buildMessages(req.messages, req.systemPrompt);

  try {
    const stream = await groq.chat.completions.create({
      model: req.model,
      messages: builtMessages,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  } catch (err: unknown) {
    if (err instanceof Groq.APIError) {
      throw new ProviderError('groq', req.model, err.message, err.status);
    }
    const message = err instanceof Error ? err.message : 'Unknown Groq streaming error';
    throw new ProviderError('groq', req.model, message);
  }
}
