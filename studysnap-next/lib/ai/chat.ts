import { env } from '../env';
import { MODEL_REGISTRY, DEFAULT_FALLBACK_ORDER } from './registry';
import { ModelId, TransientAIError } from './types';
import { HttpError } from '../httpError';

export interface ChatMsg { role: 'user' | 'assistant' | 'system'; content: string; }

const MAX_CHAT_ATTEMPTS = 3;

/**
 * Non-streaming chat completion with automatic provider fallback.
 * Capped at MAX_CHAT_ATTEMPTS to avoid burning quota on bad days.
 */
export async function chatComplete(
  messages: ChatMsg[],
  preferred?: ModelId,
): Promise<{ content: string; model: string; tokensUsed: number }> {
  const reqId = Math.random().toString(36).slice(2, 8);
  const chain: ModelId[] = [];
  if (preferred && MODEL_REGISTRY[preferred]) chain.push(preferred);
  for (const id of DEFAULT_FALLBACK_ORDER) if (!chain.includes(id)) chain.push(id);
  const configured = chain.filter((id) => MODEL_REGISTRY[id].isConfigured()).slice(0, MAX_CHAT_ATTEMPTS);
  if (configured.length === 0) {
    throw new HttpError(503, 'NO_AI_PROVIDER', 'No AI provider configured.');
  }

  console.log(`[CHAT][${reqId}] start — will try up to ${configured.length} providers: ${configured.join(', ')}`);
  let lastErr: Error | undefined;
  for (let i = 0; i < configured.length; i++) {
    const id = configured[i];
    const t0 = Date.now();
    try {
      console.log(`[CHAT][${reqId}] attempt ${i + 1}/${configured.length} — ${id}`);
      const result = await runChat(id, messages);
      console.log(`[CHAT][${reqId}] ✓ ${id} in ${Date.now() - t0}ms (${result.tokensUsed} tokens) — TOTAL: ${i + 1}`);
      return result;
    } catch (err: any) {
      console.log(`[CHAT][${reqId}] ✗ ${id} failed in ${Date.now() - t0}ms: ${err?.message ?? err}`);
      lastErr = err;
    }
  }
  console.log(`[CHAT][${reqId}] ALL ${configured.length} FAILED`);
  throw new HttpError(502, 'ALL_PROVIDERS_FAILED', `Chat failed: ${lastErr?.message ?? 'unknown'}`);
}

async function runChat(id: ModelId, messages: ChatMsg[]): Promise<{ content: string; model: string; tokensUsed: number }> {
  const spec = MODEL_REGISTRY[id];
  if (id.startsWith('gemini-')) return geminiChat(id, messages);
  return openaiStyleChat(id, messages, spec.provider);
}

async function geminiChat(id: ModelId, messages: ChatMsg[]): Promise<{ content: string; model: string; tokensUsed: number }> {
  const modelName = id === 'gemini-2.5-pro' ? 'gemini-2.5-pro' : 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.googleApiKey}`;
  const sys = messages.find((m) => m.role === 'system')?.content;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
      contents,
      generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) throw new TransientAIError('ERR', `Gemini ${res.status}`, res.status);
  const data = await res.json() as any;
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!content) throw new TransientAIError('EMPTY', 'Gemini empty response');
  const tokens = (data?.usageMetadata?.promptTokenCount ?? 0) + (data?.usageMetadata?.candidatesTokenCount ?? 0);
  return { content, model: modelName, tokensUsed: tokens };
}

async function openaiStyleChat(id: ModelId, messages: ChatMsg[], provider: string): Promise<{ content: string; model: string; tokensUsed: number }> {
  const config = getProviderConfig(id, provider);
  if (!config.apiKey) throw new TransientAIError('NO_KEY', `No key for ${id}`);
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...config.extraHeaders,
    },
    body: JSON.stringify({
      model: config.modelName,
      messages,
      temperature: 0.5,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) throw new TransientAIError('ERR', `${id} ${res.status}`, res.status);
  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content) throw new TransientAIError('EMPTY', `${id} empty response`);
  const tokens = (data?.usage?.prompt_tokens ?? 0) + (data?.usage?.completion_tokens ?? 0);
  return { content, model: config.modelName, tokensUsed: tokens };
}

function getProviderConfig(id: ModelId, _provider: string): { baseUrl: string; apiKey: string; modelName: string; extraHeaders: Record<string, string> } {
  switch (id) {
    case 'groq-llama-3.3-70b': return { baseUrl: 'https://api.groq.com/openai/v1', apiKey: env.groqApiKey, modelName: 'llama-3.3-70b-versatile', extraHeaders: {} };
    case 'groq-llama-3.1-8b': return { baseUrl: 'https://api.groq.com/openai/v1', apiKey: env.groqApiKey, modelName: 'llama-3.1-8b-instant', extraHeaders: {} };
    case 'openrouter-deepseek': return { baseUrl: 'https://openrouter.ai/api/v1', apiKey: env.openrouterApiKey, modelName: 'deepseek/deepseek-chat-v3.1:free', extraHeaders: { 'HTTP-Referer': env.appUrl, 'X-Title': 'StudySnap AI' } };
    case 'mistral-small': return { baseUrl: 'https://api.mistral.ai/v1', apiKey: env.mistralApiKey, modelName: 'mistral-small-latest', extraHeaders: {} };
    case 'github-gpt-4o-mini': return { baseUrl: 'https://models.inference.ai.azure.com', apiKey: env.githubToken, modelName: 'gpt-4o-mini', extraHeaders: {} };
    case 'github-llama-3.3-70b': return { baseUrl: 'https://models.inference.ai.azure.com', apiKey: env.githubToken, modelName: 'Llama-3.3-70B-Instruct', extraHeaders: {} };
    default: throw new Error(`Unhandled provider for ${id}`);
  }
}
