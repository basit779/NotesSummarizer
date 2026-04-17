import { DEFAULT_FALLBACK_ORDER, MODEL_REGISTRY } from './registry';
import { ModelId, PermanentAIError, ProviderResult, TransientAIError } from './types';
import { HttpError } from '../httpError';

/** Hard cap on how many providers we try per request. Protects quotas. */
const MAX_ATTEMPTS = 3;

/** Error codes that are caused by the prompt producing too much output — retryable on the same provider with a smaller prompt, no need to burn the next provider's quota. */
const BAD_OUTPUT_CODES = new Set(['BAD_JSON', 'BAD_RESPONSE']);

export async function runWithFallback(
  text: string,
  plan: 'FREE' | 'PRO',
  preferred?: ModelId,
): Promise<ProviderResult & { attempted: { id: ModelId; error?: string }[] }> {
  const reqId = Math.random().toString(36).slice(2, 8);

  const chain: ModelId[] = [];
  if (preferred && MODEL_REGISTRY[preferred]) chain.push(preferred);
  for (const id of DEFAULT_FALLBACK_ORDER) {
    if (!chain.includes(id)) chain.push(id);
  }

  const configured = chain.filter((id) => MODEL_REGISTRY[id].isConfigured()).slice(0, MAX_ATTEMPTS);
  if (configured.length === 0) {
    throw new HttpError(
      503,
      'NO_AI_PROVIDER',
      'No AI provider configured. Set at least one of: GOOGLE_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY, GITHUB_TOKEN.',
    );
  }

  console.log(`[AI][${reqId}] start — will try up to ${configured.length} providers: ${configured.join(', ')}`);

  const attempted: { id: ModelId; error?: string }[] = [];
  let lastError: Error | undefined;

  for (let i = 0; i < configured.length; i++) {
    const id = configured[i];
    const spec = MODEL_REGISTRY[id];
    const t0 = Date.now();
    try {
      console.log(`[AI][${reqId}] attempt ${i + 1}/${configured.length} — ${id}`);
      const result = await spec.run(text, plan);
      const elapsed = Date.now() - t0;
      console.log(`[AI][${reqId}] ✓ ${id} succeeded in ${elapsed}ms (${result.tokensUsed} tokens) — TOTAL API CALLS: ${i + 1}`);
      attempted.push({ id });
      return { ...result, attempted };
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      if (err instanceof PermanentAIError) {
        console.log(`[AI][${reqId}] ✗ ${id} permanent error in ${elapsed}ms: ${err.code}`);
        throw new HttpError(400, err.code, err.message);
      }
      const code = err instanceof TransientAIError ? err.code : 'ERROR';
      const msg = err instanceof TransientAIError ? `${err.code}: ${err.message}` : String(err?.message ?? err);
      console.log(`[AI][${reqId}] ✗ ${id} failed in ${elapsed}ms: ${msg}`);

      // Same-provider retry with minimal prompt on output-shape failures.
      // This saves the next provider's quota when the real problem was just
      // that Gemini's 4096 output cap truncated the JSON.
      if (BAD_OUTPUT_CODES.has(code)) {
        const t1 = Date.now();
        try {
          console.log(`[AI][${reqId}] ↻ ${id} retrying with minimal prompt`);
          const result = await spec.run(text, plan, { minimal: true });
          const elapsed2 = Date.now() - t1;
          console.log(`[AI][${reqId}] ✓ ${id} minimal-retry succeeded in ${elapsed2}ms (${result.tokensUsed} tokens) — TOTAL API CALLS: ${i + 2}`);
          attempted.push({ id, error: `${msg} → recovered via minimal retry` });
          return { ...result, attempted };
        } catch (err2: any) {
          const elapsed2 = Date.now() - t1;
          const msg2 = err2 instanceof TransientAIError ? `${err2.code}: ${err2.message}` : String(err2?.message ?? err2);
          console.log(`[AI][${reqId}] ✗ ${id} minimal-retry failed in ${elapsed2}ms: ${msg2}`);
          attempted.push({ id, error: `${msg} | minimal-retry: ${msg2}` });
          lastError = err2;
          continue;
        }
      }

      attempted.push({ id, error: msg });
      lastError = err;
    }
  }

  console.log(`[AI][${reqId}] ALL ${configured.length} PROVIDERS FAILED`);
  throw new HttpError(
    502,
    'ALL_PROVIDERS_FAILED',
    `Tried ${configured.length} providers, all failed. Last error: ${lastError?.message ?? 'unknown'}`,
  );
}
