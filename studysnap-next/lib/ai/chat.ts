import { env } from '../env';
import { MODEL_REGISTRY, DEFAULT_FALLBACK_ORDER } from './registry';
import { ModelId, TransientAIError } from './types';
import { HttpError } from '../httpError';

export interface ChatMsg { role: 'user' | 'assistant' | 'system'; content: string; }

const MAX_CHAT_ATTEMPTS = 4;
const RATE_LIMIT_WAIT_MS = 7_000;

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Non-streaming chat completion with automatic provider fallback.
 *
 * Behaviors matched to runWithFallback for consistency:
 *  - MAX_ATTEMPTS=3 cap per request
 *  - On the FIRST 429 in the request, sleep 7s and retry the same provider
 *    before cascading (free-tier per-minute buckets usually refill within
 *    that window)
 *  - On complete failure, throws ALL_RATE_LIMITED (429) if every attempt
 *    was rate-limited, otherwise ALL_PROVIDERS_FAILED (502)
 *
 * Callers should catch HttpError(ALL_*) and surface a graceful user-facing
 * message rather than the raw error.
 */
export async function chatComplete(
  messages: ChatMsg[],
  preferred?: ModelId,
): Promise<{ content: string; model: string; tokensUsed: number; attempted: { id: ModelId; error?: string }[] }> {
  const reqId = Math.random().toString(36).slice(2, 8);
  const chain: ModelId[] = [];
  if (preferred && MODEL_REGISTRY[preferred]) chain.push(preferred);
  for (const id of DEFAULT_FALLBACK_ORDER) if (!chain.includes(id)) chain.push(id);
  const configured = chain.filter((id) => MODEL_REGISTRY[id].isConfigured()).slice(0, MAX_CHAT_ATTEMPTS);
  if (configured.length === 0) {
    throw new HttpError(503, 'NO_AI_PROVIDER', 'No AI provider configured.');
  }

  console.log(`[CHAT][${reqId}] start — will try up to ${configured.length} providers: ${configured.join(', ')}`);

  const attempted: { id: ModelId; error?: string }[] = [];
  let lastErr: Error | undefined;
  let rateLimitedCount = 0;

  for (let i = 0; i < configured.length; i++) {
    const id = configured[i];
    const t0 = Date.now();
    try {
      console.log(`[CHAT][${reqId}] attempt ${i + 1}/${configured.length} — ${id}`);
      const result = await runChat(id, messages);
      console.log(`[CHAT][${reqId}] ✓ ${id} in ${Date.now() - t0}ms (${result.tokensUsed} tokens) — TOTAL: ${i + 1}`);
      attempted.push({ id });
      return { ...result, attempted };
    } catch (err: any) {
      const code = err instanceof TransientAIError ? err.code : 'ERROR';
      const status = err instanceof TransientAIError ? err.status : undefined;
      const msg = err instanceof TransientAIError ? `${err.code}: ${err.message}` : String(err?.message ?? err);
      console.log(`[CHAT][${reqId}] ✗ ${id} failed in ${Date.now() - t0}ms: ${msg}`);

      // Wait-retry ONCE per request when the first provider rate-limits.
      const isRateLimit = code === 'RATE_LIMIT' || status === 429;
      if (isRateLimit && rateLimitedCount === 0) {
        rateLimitedCount++;
        console.log(`[CHAT][${reqId}] ⏱ ${id} rate-limited — sleeping ${RATE_LIMIT_WAIT_MS}ms then retrying`);
        await sleep(RATE_LIMIT_WAIT_MS);
        const t1 = Date.now();
        try {
          const result = await runChat(id, messages);
          console.log(`[CHAT][${reqId}] ✓ ${id} wait-retry succeeded in ${Date.now() - t1}ms`);
          attempted.push({ id, error: `${msg} → recovered after wait` });
          return { ...result, attempted };
        } catch (err2: any) {
          const msg2 = err2 instanceof TransientAIError ? `${err2.code}: ${err2.message}` : String(err2?.message ?? err2);
          console.log(`[CHAT][${reqId}] ✗ ${id} wait-retry failed: ${msg2}`);
          attempted.push({ id, error: `${msg} | wait-retry: ${msg2}` });
          lastErr = err2;
          continue;
        }
      }

      attempted.push({ id, error: msg });
      lastErr = err;
    }
  }

  console.log(`[CHAT][${reqId}] ALL ${configured.length} FAILED`);

  const allRateLimited = attempted.every((a) => {
    if (!a.error) return false;
    return a.error.includes('RATE_LIMIT') || a.error.includes('rate-limit') || a.error.includes('429');
  });
  if (allRateLimited) {
    throw new HttpError(429, 'ALL_RATE_LIMITED',
      'All free-tier AI providers are temporarily rate-limited. Wait ~60 seconds and try again.');
  }
  throw new HttpError(502, 'ALL_PROVIDERS_FAILED', `Chat failed: ${lastErr?.message ?? 'unknown'}`);
}

async function runChat(id: ModelId, messages: ChatMsg[]): Promise<{ content: string; model: string; tokensUsed: number }> {
  const spec = MODEL_REGISTRY[id];
  if (id.startsWith('gemini-')) return geminiChat(id, messages);
  return openaiStyleChat(id, messages, spec.provider);
}

async function geminiChat(id: ModelId, messages: ChatMsg[]): Promise<{ content: string; model: string; tokensUsed: number }> {
  // Map ModelId → actual Gemini API model name. Default falls back to 2.0-flash
  // so an unknown future Gemini id never breaks chat.
  const modelName = id.startsWith('gemini-') ? id : 'gemini-2.0-flash';
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
      generationConfig: { temperature: 0.5, maxOutputTokens: 800 },
    }),
  });
  if (res.status === 429) throw new TransientAIError('RATE_LIMIT', `Gemini ${modelName} rate-limited`, 429);
  if (res.status >= 500) throw new TransientAIError('UPSTREAM', `Gemini ${modelName} ${res.status}`, res.status);
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
      max_tokens: config.maxOutput ?? 2048,
      ...(config.extraBody ?? {}),
    }),
  });
  if (res.status === 429) throw new TransientAIError('RATE_LIMIT', `${id} rate-limited`, 429);
  if (res.status >= 500) throw new TransientAIError('UPSTREAM', `${id} ${res.status}`, res.status);
  if (!res.ok) throw new TransientAIError('ERR', `${id} ${res.status}`, res.status);
  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content) throw new TransientAIError('EMPTY', `${id} empty response`);
  const tokens = (data?.usage?.prompt_tokens ?? 0) + (data?.usage?.completion_tokens ?? 0);
  return { content, model: config.modelName, tokensUsed: tokens };
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  extraHeaders: Record<string, string>;
  maxOutput?: number;
  /** Spread into request body — e.g. DeepSeek's thinking-disable flags. */
  extraBody?: Record<string, unknown>;
}

function getProviderConfig(id: ModelId, _provider: string): ProviderConfig {
  switch (id) {
    case 'groq-llama-3.3-70b': return { baseUrl: 'https://api.groq.com/openai/v1', apiKey: env.groqApiKey, modelName: 'llama-3.3-70b-versatile', extraHeaders: {}, maxOutput: 600 };
    case 'groq-llama-3.1-8b':  return { baseUrl: 'https://api.groq.com/openai/v1', apiKey: env.groqApiKey, modelName: 'llama-3.1-8b-instant',   extraHeaders: {}, maxOutput: 600 };
    case 'openrouter-free':    return { baseUrl: 'https://openrouter.ai/api/v1', apiKey: env.openrouterApiKey, modelName: 'openrouter/free', extraHeaders: { 'HTTP-Referer': env.appUrl, 'X-Title': 'StudySnap AI' }, maxOutput: 600 };
    case 'mistral-small':       return { baseUrl: 'https://api.mistral.ai/v1',    apiKey: env.mistralApiKey,    modelName: 'mistral-small-latest',              extraHeaders: {}, maxOutput: 600 };
    case 'github-gpt-4o-mini':  return { baseUrl: 'https://models.inference.ai.azure.com', apiKey: env.githubToken, modelName: 'gpt-4o-mini',               extraHeaders: {}, maxOutput: 600 };
    case 'github-llama-3.3-70b':return { baseUrl: 'https://models.inference.ai.azure.com', apiKey: env.githubToken, modelName: 'Llama-3.3-70B-Instruct',    extraHeaders: {}, maxOutput: 600 };
    // DeepSeek V4-Flash — paid backup for chat. Same thinking-disable flags
    // as the pack-generation path (registry.ts deepseek-v4-flash entry):
    // V4-Flash defaults to thinking mode which burns tokens and breaks short
    // chat replies. Both V4-docs and V3.1/vLLM-hosted format are sent in
    // parallel — whichever upstream variant honors wins, unknown fields ignored.
    case 'deepseek-v4-flash':   return {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY ?? '',
      modelName: 'deepseek-v4-flash',
      extraHeaders: {},
      maxOutput: 800,
      extraBody: {
        thinking: { type: 'disabled' },
        chat_template_kwargs: { thinking: false },
      },
    };
    default: throw new Error(`Unhandled provider for ${id}`);
  }
}
