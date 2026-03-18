import OpenAI from 'openai';
import { ProviderError, type ProviderRequest, type ProviderCallResult, type Message } from './types';

// ---------------------------------------------------------------------------
// OpenAI Provider — GPT-4o, GPT-4o Mini, o1 Mini
// ---------------------------------------------------------------------------

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ProviderError('openai', '', 'OPENAI_API_KEY is not set');
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

function buildMessages(
  messages: Message[],
  systemPrompt?: string,
): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }

  for (const m of messages) {
    if (m.role === 'system') continue; // already handled via systemPrompt
    result.push({ role: m.role, content: m.content });
  }

  return result;
}

export async function callOpenAI(req: ProviderRequest): Promise<ProviderCallResult> {
  const openai = getClient();
  const builtMessages = buildMessages(req.messages, req.systemPrompt);

  try {
    const response = await openai.chat.completions.create({
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
    if (err instanceof OpenAI.APIError) {
      throw new ProviderError('openai', req.model, err.message, err.status);
    }
    const message = err instanceof Error ? err.message : 'Unknown OpenAI error';
    throw new ProviderError('openai', req.model, message);
  }
}

export async function* streamOpenAI(req: ProviderRequest): AsyncGenerator<string> {
  // o1-mini does not support streaming
  if (req.model === 'o1-mini') {
    throw new ProviderError(
      'openai',
      req.model,
      'o1-mini does not support streaming. Use generateResponse() instead.',
    );
  }

  const openai = getClient();
  const builtMessages = buildMessages(req.messages, req.systemPrompt);

  try {
    const stream = await openai.chat.completions.create({
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
    if (err instanceof OpenAI.APIError) {
      throw new ProviderError('openai', req.model, err.message, err.status);
    }
    const message = err instanceof Error ? err.message : 'Unknown OpenAI streaming error';
    throw new ProviderError('openai', req.model, message);
  }
}
