import { DEFAULT_FALLBACK_ORDER, MODEL_REGISTRY } from './registry';
import { ModelId, PermanentAIError, ProviderResult, TransientAIError } from './types';
import { HttpError } from '../httpError';
import { logProviderEvent } from './telemetry';

/** Hard cap on how many providers we try per request. Protects quotas. */
const MAX_ATTEMPTS = 3;

/** Error codes caused by prompt producing too much output — retry same provider with smaller prompt. */
const BAD_OUTPUT_CODES = new Set(['BAD_JSON', 'BAD_RESPONSE']);

/** How long to wait before retrying after a rate-limit error. Free-tier RPM/TPM buckets clear within ~60s. */
const RATE_LIMIT_WAIT_MS = 7_000;

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

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
  let rateLimitedCount = 0;

  for (let i = 0; i < configured.length; i++) {
    const id = configured[i];
    const spec = MODEL_REGISTRY[id];
    const t0 = Date.now();
    try {
      console.log(`[AI][${reqId}] attempt ${i + 1}/${configured.length} — ${id}`);
      const result = await spec.run(text, plan);
      const elapsed = Date.now() - t0;
      console.log(`[AI][${reqId}] ✓ ${id} succeeded in ${elapsed}ms (${result.tokensUsed} tokens) — TOTAL API CALLS: ${i + 1}`);
      logProviderEvent({ reqId, providerId: id, outcome: 'success', elapsedMs: elapsed, tokensUsed: result.tokensUsed });
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
      logProviderEvent({
        reqId,
        providerId: id,
        outcome: code === 'RATE_LIMIT' ? 'rate_limit'
          : code === 'BAD_JSON' ? 'bad_json'
          : code === 'BAD_RESPONSE' ? 'bad_response'
          : code === 'UPSTREAM' ? 'upstream_error'
          : code === 'NO_KEY' ? 'no_key'
          : 'transient_error',
        elapsedMs: elapsed,
        errorCode: code,
      });

      // RATE_LIMIT: wait for the per-minute bucket to clear, then retry same provider ONCE.
      // Only do this wait once per request (otherwise we'd exceed the 60s route timeout).
      if (code === 'RATE_LIMIT' && rateLimitedCount === 0) {
        rateLimitedCount++;
        console.log(`[AI][${reqId}] ⏱ ${id} rate-limited — waiting ${RATE_LIMIT_WAIT_MS}ms then retrying same provider`);
        await sleep(RATE_LIMIT_WAIT_MS);
        const t1 = Date.now();
        try {
          console.log(`[AI][${reqId}] ↻ ${id} wait-retry`);
          const result = await spec.run(text, plan);
          const elapsed2 = Date.now() - t1;
          console.log(`[AI][${reqId}] ✓ ${id} wait-retry succeeded in ${elapsed2}ms (${result.tokensUsed} tokens)`);
          attempted.push({ id, error: `${msg} → recovered after ${RATE_LIMIT_WAIT_MS}ms wait` });
          return { ...result, attempted };
        } catch (err2: any) {
          const elapsed2 = Date.now() - t1;
          const code2 = err2 instanceof TransientAIError ? err2.code : 'ERROR';
          const msg2 = err2 instanceof TransientAIError ? `${err2.code}: ${err2.message}` : String(err2?.message ?? err2);
          console.log(`[AI][${reqId}] ✗ ${id} wait-retry failed in ${elapsed2}ms: ${msg2}`);
          attempted.push({ id, error: `${msg} | wait-retry: ${msg2}` });
          lastError = err2;
          // Fall through to next provider — if same provider still rate-limited,
          // the next one in the chain may use a different org (diversified below).
          continue;
        }
      }

      // BAD_JSON / BAD_RESPONSE: prompt was too big for model's output cap.
      // Retry same provider with minimal prompt before burning next provider's quota.
      if (BAD_OUTPUT_CODES.has(code)) {
        const t1 = Date.now();
        try {
          console.log(`[AI][${reqId}] ↻ ${id} retrying with minimal prompt`);
          const result = await spec.run(text, plan, { minimal: true });
          const elapsed2 = Date.now() - t1;
          console.log(`[AI][${reqId}] ✓ ${id} minimal-retry succeeded in ${elapsed2}ms (${result.tokensUsed} tokens)`);
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

  // If the reason we failed is rate-limits across the board, give the user a
  // useful message instead of dumping raw provider errors in the UI.
  const allRateLimited = attempted.every((a) => {
    if (!a.error) return false;
    return a.error.includes('RATE_LIMIT') || a.error.includes('rate-limit') || a.error.includes('429');
  });
  if (allRateLimited) {
    throw new HttpError(
      429,
      'ALL_RATE_LIMITED',
      'All free-tier AI providers are temporarily rate-limited. Wait ~60 seconds and try again — the per-minute quotas will refill.',
    );
  }

  throw new HttpError(
    502,
    'ALL_PROVIDERS_FAILED',
    `Tried ${configured.length} providers, all failed. Last error: ${lastError?.message ?? 'unknown'}`,
  );
}
