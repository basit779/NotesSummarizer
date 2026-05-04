import { getFallbackOrder, MODEL_REGISTRY } from './registry';
import { ModelId, PermanentAIError, ProviderResult, TransientAIError } from './types';
import { HttpError } from '../httpError';
import { logProviderEvent } from './telemetry';
import { selectTier } from '../prompts';

/**
 * Run a single provider, no fallback. Used by the Inngest per-provider step
 * orchestrator (lib/inngest.ts) so each provider attempt can be checkpointed
 * as its own Inngest step + Vercel function invocation.
 *
 * Throws TransientAIError on transient failures (timeouts, rate limits, bad
 * JSON, etc.) and PermanentAIError on input-too-large / no-key. The orchestrator
 * catches transient errors and advances to the next provider; permanent errors
 * propagate to the user via the Inngest function's catch block.
 */
export async function runOneProvider(
  id: ModelId,
  text: string,
  plan: 'FREE' | 'PRO',
  opts: { pages?: number; pass?: 1 | 2; minimal?: boolean; ultraMinimal?: boolean; timeoutMs?: number } = {},
): Promise<ProviderResult> {
  const spec = MODEL_REGISTRY[id];
  if (!spec) throw new PermanentAIError('UNKNOWN_PROVIDER', `Unknown provider: ${id}`);
  if (!spec.isConfigured()) throw new TransientAIError('NO_KEY', `${id} not configured`);
  return spec.run(text, plan, opts);
}

/** Hard cap on how many providers we try per request. Protects quotas while
 *  still letting the entire fallback chain run when every Gemini variant is
 *  rate-limited.
 *
 *  Was 4, which capped attempts at the first 4 entries — exactly the Gemini
 *  block — meaning Mistral/OpenRouter/Groq were configured but unreachable
 *  when Google quotas were exhausted. Bumped to 8 so all configured non-Google
 *  fallbacks actually fire. The slice in `configured` operates on a unique
 *  chain, so MAX_ATTEMPTS=8 against a 7-provider chain just runs all 7 once;
 *  there's no duplicate retry. */
const MAX_ATTEMPTS = 8;

/** Error codes recoverable by retrying the same provider with `minimal=true`,
 *  which scales the prompt's requested item counts by ~0.7. Smaller counts =
 *  smaller output = fits the 8K completion cap, parses cleanly, and stays
 *  within rolling TPM budgets.
 *
 *  MAX_TOKENS is included: counter-intuitive at first (the schema is the
 *  schema), but the prompt's COUNTS field is what tells the model how many
 *  flashcards/MCQs to generate. Reducing counts directly cuts output volume
 *  and is exactly the right recovery for an 8K-cap truncation. */
const BAD_OUTPUT_CODES = new Set(['BAD_JSON', 'BAD_RESPONSE', 'MAX_TOKENS']);

/** Cap on how long we'll wait before retrying the same provider after a 429.
 *  Longer waits eat into the 60s route budget and we'd rather advance to the
 *  next provider than block. */
const MAX_RATE_LIMIT_WAIT_MS = 8_000;

/** Floor on rate-limit wait — upstream sometimes says "retry in 0s" which is
 *  just asking to be hammered. Wait at least this long. */
const MIN_RATE_LIMIT_WAIT_MS = 1_500;

/** Default wait when a provider returns 429 without a Retry-After hint AND the
 *  chain only has one remaining provider (i.e. the same one). Kept generous
 *  enough for the per-minute bucket to partially refill. Only used in that
 *  last-resort branch. */
const FALLBACK_NO_HINT_WAIT_MS = 5_000;

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/** Primary provider — the best-quality model we try first. */
const PRIMARY_PROVIDER: ModelId = 'gemini-2.5-flash';

/** Returns true when the winning provider IS the active chain's primary
 *  (first provider we'd actually try after filtering for isConfigured). A
 *  primary win reports `fallbackUsed: null`; anything else reports its ID so
 *  the UI can show a "fallback used" / "Fast mode" indicator.
 *
 *  Used to be hardcoded to `id.startsWith('gemini-')` back when Gemini was
 *  primary — now derived from the chain so it stays correct as chains evolve. */
function isPrimary(id: ModelId, primaryId: ModelId | undefined): boolean {
  return id === primaryId;
}

// ——————————————————————————————————————————————————————————————
// Per-process provider cooldown
//
// When a provider returns 429 with a Retry-After hint that's too long to wait
// out (> MAX_RATE_LIMIT_WAIT_MS), mark it as cooling down in this Map. The
// next request in the same Node process will skip the provider entirely while
// it's still cooling.
//
// Empty across serverless cold-starts — only helps during warm invocations
// and local dev bursts. That's exactly the scenario the user hit in testing.
// ——————————————————————————————————————————————————————————————
const providerCooldownUntil = new Map<ModelId, number>();

function markProviderCooldown(id: ModelId, retryAfterSeconds: number) {
  providerCooldownUntil.set(id, Date.now() + retryAfterSeconds * 1000);
}

function getCooldownSecondsLeft(id: ModelId): number {
  const until = providerCooldownUntil.get(id);
  if (!until) return 0;
  const ms = until - Date.now();
  if (ms <= 0) {
    providerCooldownUntil.delete(id);
    return 0;
  }
  return Math.ceil(ms / 1000);
}

export async function runWithFallback(
  text: string,
  plan: 'FREE' | 'PRO',
  preferred?: ModelId,
  pages?: number,
  pass?: 1 | 2,
): Promise<ProviderResult & { attempted: { id: ModelId; error?: string }[]; fallbackUsed: string | null }> {
  const reqId = Math.random().toString(36).slice(2, 8);

  // Tier-aware fallback order. XL demotes Groq (TPM-bound, small per-request
  // budget) in favor of Mistral + DeepSeek which have generous free-tier TPM.
  const tier = selectTier(text.length, pages);
  const chain: ModelId[] = [];
  if (preferred && MODEL_REGISTRY[preferred]) chain.push(preferred);
  for (const id of getFallbackOrder(tier)) {
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

  console.log(`[AI][${reqId}] start tier=${tier}${pass ? ` pass=${pass}` : ''} — will try up to ${configured.length} providers: ${configured.join(', ')}`);

  const attempted: { id: ModelId; error?: string }[] = [];
  let lastError: Error | undefined;
  let rateLimitedCount = 0;
  // Tracks whether the immediately-prior attempt 429'd. When true we add a
  // small jittered sleep before the next attempt so we don't hammer a chain
  // of providers in <1s when the first one fast-fails. Skipped for slow
  // failures (BAD_JSON / MAX_TOKENS) where the cycle is already 5-40s long.
  let prevWasRateLimit = false;

  for (let i = 0; i < configured.length; i++) {
    const id = configured[i];
    const spec = MODEL_REGISTRY[id];

    if (i > 0 && prevWasRateLimit) {
      const jitterMs = 200 + Math.floor(Math.random() * 200);
      console.log(`[AI][${reqId}] ⏳ jitter ${jitterMs}ms before attempt ${i + 1} (prev was rate-limit)`);
      await sleep(jitterMs);
    }
    prevWasRateLimit = false;

    // Skip providers still in process-local cooldown from a recent 429.
    const cooling = getCooldownSecondsLeft(id);
    if (cooling > 0) {
      console.log(`[AI][${reqId}] ⤵ skip ${id} — cooling ${cooling}s more (process-local)`);
      // Keep "rate-limit" in the error so the final allRateLimited detection fires correctly.
      attempted.push({ id, error: `RATE_LIMIT: skipped — rate-limit cooldown ${cooling}s` });
      continue;
    }

    const t0 = Date.now();
    try {
      console.log(`[AI][${reqId}] attempt ${i + 1}/${configured.length} — ${id}${pass ? ` pass=${pass}` : ''}`);
      const result = await spec.run(text, plan, { pages, pass });
      const elapsed = Date.now() - t0;
      console.log(`[AI][${reqId}] ✓ ${id} succeeded in ${elapsed}ms (${result.tokensUsed} tokens) — TOTAL API CALLS: ${i + 1}`);
      logProviderEvent({ reqId, providerId: id, outcome: 'success', elapsedMs: elapsed, tokensUsed: result.tokensUsed });
      attempted.push({ id });
      return { ...result, attempted, fallbackUsed: isPrimary(id, configured[0]) ? null : id };
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      if (err instanceof PermanentAIError) {
        console.log(`[AI][${reqId}] ✗ ${id} permanent error in ${elapsed}ms: ${err.code}`);
        throw new HttpError(400, err.code, err.message);
      }
      const code = err instanceof TransientAIError ? err.code : 'ERROR';
      const msg = err instanceof TransientAIError ? `${err.code}: ${err.message}` : String(err?.message ?? err);
      // Set the jitter flag once here — covers every continue branch below.
      prevWasRateLimit = code === 'RATE_LIMIT';
      console.log(`[AI][${reqId}] ✗ ${id} failed in ${elapsed}ms: ${msg}`);
      logProviderEvent({
        reqId,
        providerId: id,
        outcome: code === 'RATE_LIMIT' ? 'rate_limit'
          : code === 'BAD_JSON' ? 'bad_json'
          : code === 'BAD_RESPONSE' ? 'bad_response'
          : code === 'MAX_TOKENS' ? 'max_tokens'
          : code === 'UPSTREAM' ? 'upstream_error'
          : code === 'NO_KEY' ? 'no_key'
          : 'transient_error',
        elapsedMs: elapsed,
        errorCode: code,
      });

      // RATE_LIMIT: use the upstream Retry-After hint to decide whether to
      // wait-and-retry or advance to the next provider. Old behavior was a
      // hardcoded 7s wait regardless of hint — that burned latency when the
      // real quota reset was 60s (so the retry failed anyway) and over-waited
      // when the reset was <7s.
      if (code === 'RATE_LIMIT') {
        const rawRetryAfter = err instanceof TransientAIError ? err.retryAfterSeconds : undefined;
        // Google quirk: sometimes returns retry-after=0 when the real cause
        // is a per-minute bucket that resets on minute boundary. Treat 0 as
        // "unknown" so we apply the no-hint rules below.
        const retryAfter = rawRetryAfter && rawRetryAfter > 0 ? rawRetryAfter : undefined;
        const isLastProvider = i === configured.length - 1;

        // Mark cooldown so subsequent requests in this same Node process skip
        // this provider until its quota has refreshed. If hint was 0 or
        // missing, assume a conservative 30s cooldown (minute-boundary reset).
        const cooldownSec = retryAfter ?? 30;
        markProviderCooldown(id, cooldownSec);

        // Decide: wait here, or advance to next provider?
        let waitMs: number | null = null;
        if (retryAfter != null) {
          const requestedMs = retryAfter * 1000;
          if (requestedMs <= MAX_RATE_LIMIT_WAIT_MS) {
            waitMs = Math.max(requestedMs, MIN_RATE_LIMIT_WAIT_MS);
          } else {
            // Quota won't refresh within our budget — advance instead of waiting.
            console.log(`[AI][${reqId}] ⏭ ${id} rate-limited (retry-after ${retryAfter}s > ${Math.round(MAX_RATE_LIMIT_WAIT_MS / 1000)}s budget) — advancing to next provider`);
            attempted.push({ id, error: `${msg} → retry-after ${retryAfter}s exceeds wait budget` });
            lastError = err;
            continue;
          }
        } else if (isLastProvider && rateLimitedCount === 0) {
          // No hint AND nothing else to try — take one shot at a short blind wait.
          waitMs = FALLBACK_NO_HINT_WAIT_MS;
        }

        if (waitMs == null) {
          // No hint and we still have other providers to try — advance.
          console.log(`[AI][${reqId}] ⏭ ${id} rate-limited (no Retry-After hint) — advancing to next provider`);
          attempted.push({ id, error: msg });
          lastError = err;
          continue;
        }

        if (rateLimitedCount >= 1) {
          // Already spent one wait on this request — don't burn the 60s route budget further.
          console.log(`[AI][${reqId}] ⏭ ${id} rate-limited — already spent one wait on this request, advancing`);
          attempted.push({ id, error: msg });
          lastError = err;
          continue;
        }

        rateLimitedCount++;
        console.log(`[AI][${reqId}] ⏱ ${id} rate-limited — ${retryAfter != null ? `upstream asked for ${retryAfter}s` : 'no hint'}, waiting ${waitMs}ms then retrying`);
        await sleep(waitMs);
        const t1 = Date.now();
        try {
          console.log(`[AI][${reqId}] ↻ ${id} wait-retry`);
          const result = await spec.run(text, plan, { pages, pass });
          const elapsed2 = Date.now() - t1;
          console.log(`[AI][${reqId}] ✓ ${id} wait-retry succeeded in ${elapsed2}ms (${result.tokensUsed} tokens)`);
          providerCooldownUntil.delete(id);  // clear cooldown on success
          attempted.push({ id, error: `${msg} → recovered after ${waitMs}ms wait` });
          return { ...result, attempted, fallbackUsed: isPrimary(id, configured[0]) ? null : id };
        } catch (err2: any) {
          const elapsed2 = Date.now() - t1;
          const msg2 = err2 instanceof TransientAIError ? `${err2.code}: ${err2.message}` : String(err2?.message ?? err2);
          // Record updated cooldown if the retry gave a fresher hint.
          const retryAfter2 = err2 instanceof TransientAIError ? err2.retryAfterSeconds : undefined;
          if (retryAfter2 && retryAfter2 > 0) markProviderCooldown(id, retryAfter2);
          console.log(`[AI][${reqId}] ✗ ${id} wait-retry failed in ${elapsed2}ms: ${msg2}`);
          attempted.push({ id, error: `${msg} | wait-retry: ${msg2}` });
          lastError = err2;
          continue;
        }
      }

      // BAD_JSON / BAD_RESPONSE: prompt was too big for model's output cap.
      // Retry same provider with minimal prompt before burning next provider's quota.
      if (BAD_OUTPUT_CODES.has(code)) {
        const t1 = Date.now();
        try {
          console.log(`[AI][${reqId}] ↻ ${id} retrying with minimal prompt`);
          const result = await spec.run(text, plan, { minimal: true, pages, pass });
          const elapsed2 = Date.now() - t1;
          console.log(`[AI][${reqId}] ✓ ${id} minimal-retry succeeded in ${elapsed2}ms (${result.tokensUsed} tokens)`);
          attempted.push({ id, error: `${msg} → recovered via minimal retry` });
          return { ...result, attempted, fallbackUsed: isPrimary(id, configured[0]) ? null : id };
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

  // If every provider rejected the input as too large, no amount of fallback
  // will help — surface a clear "doc too long" error to the user instead of
  // a generic "all providers failed".
  const anyInputTooLarge = attempted.some((a) => a.error?.includes('INPUT_TOO_LARGE'));
  const allInputTooLarge = anyInputTooLarge && attempted.every((a) => {
    if (!a.error) return false;
    return a.error.includes('INPUT_TOO_LARGE');
  });
  if (allInputTooLarge) {
    throw new HttpError(
      413,
      'DOC_TOO_LARGE',
      'This document is too long for our free-tier AI providers to process. Try a shorter document or split it into sections.',
    );
  }

  throw new HttpError(
    502,
    'ALL_PROVIDERS_FAILED',
    `Tried ${configured.length} providers, all failed. Last error: ${lastError?.message ?? 'unknown'}`,
  );
}
