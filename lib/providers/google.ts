import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { ProviderError, type ProviderRequest, type ProviderCallResult } from './types';

// ---------------------------------------------------------------------------
// Google Provider — Gemini 2.0 Flash, Gemini 1.5 Pro
// ---------------------------------------------------------------------------

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new ProviderError('google', '', 'GOOGLE_AI_API_KEY is not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Map our messages to Google's Content format.
 * Google uses "user" and "model" roles (not "assistant").
 * System messages are passed via systemInstruction, so we skip them here.
 */
function buildHistory(
  messages: ProviderRequest['messages'],
): { history: Content[]; lastMessage: string } {
  const filtered = messages.filter((m) => m.role !== 'system');

  if (filtered.length === 0) {
    throw new ProviderError('google', '', 'At least one user message is required');
  }

  const history: Content[] = [];
  for (let i = 0; i < filtered.length - 1; i++) {
    const m = filtered[i];
    history.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  }

  const last = filtered[filtered.length - 1];
  return { history, lastMessage: last.content };
}

export async function callGoogle(req: ProviderRequest): Promise<ProviderCallResult> {
  const client = getClient();

  const model = client.getGenerativeModel({
    model: req.model,
    systemInstruction: req.systemPrompt ?? undefined,
    generationConfig: {
      maxOutputTokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    },
  });

  const { history, lastMessage } = buildHistory(req.messages);

  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage);
    const response = result.response;

    const content = response.text();
    const tokensIn = response.usageMetadata?.promptTokenCount ?? 0;
    const tokensOut = response.usageMetadata?.candidatesTokenCount ?? 0;

    return { content, tokensIn, tokensOut };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Google AI error';
    throw new ProviderError('google', req.model, message);
  }
}

export async function* streamGoogle(req: ProviderRequest): AsyncGenerator<string> {
  const client = getClient();

  const model = client.getGenerativeModel({
    model: req.model,
    systemInstruction: req.systemPrompt ?? undefined,
    generationConfig: {
      maxOutputTokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    },
  });

  const { history, lastMessage } = buildHistory(req.messages);

  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Google AI streaming error';
    throw new ProviderError('google', req.model, message);
  }
}
