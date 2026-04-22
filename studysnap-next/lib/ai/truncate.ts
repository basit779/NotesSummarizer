/**
 * Per-model INPUT token budgets (text payload only — system prompt, schema
 * and output reserved separately). Heuristic: 1 token ≈ 4 characters.
 *
 * TIER-AWARE since the XL shallowness fix: SHORT/MEDIUM/LONG keep the
 * original TPM-conservative budgets (fast, reliable). XL pushes budgets
 * to the per-request TPM ceiling on Groq so fallback on large docs covers
 * meaningfully more source. Larger-context providers (Gemini, Mistral,
 * DeepSeek) already have enough headroom that per-tier variance isn't
 * needed — the flat number works across tiers.
 *
 * Free-tier TPM caps each call's TOTAL tokens (input + output + overhead)
 * in a rolling 60s window. Groq enforces this PER-REQUEST — a single call
 * that exceeds TPM instant-429s, the minute doesn't bucket. Overhead is
 * larger than first estimated because `STUDY_MATERIAL_SCHEMA` is inlined
 * into the user prompt for OpenAI-style providers (see openaiCompat.ts) —
 * system prompt + schema JSON + scaffolding runs ~1.1-1.4k tokens.
 *   - Groq 70B XL: input 4.5k + out 4k + overhead ≈ 10k (leaves 2k under 12k TPM)
 *   - Groq 8B XL:  input 1.6k + out 2.5k + overhead ≈ 5.2k (leaves 0.8k under 6k TPM)
 *   - Gemini Flash: 1M TPM — effectively unlimited
 *   - Mistral Small: 500K TPM — generous, flat 8k suffices
 *   - OpenRouter Free (auto-router): no tight TPM, flat 10k suffices
 */

import { type Tier } from '../prompts';

type TierBudget = Record<Tier, number>;

const TOKEN_BUDGETS: Record<string, TierBudget> = {
  'gemini-2.5-pro':       { short: 40_000, medium: 40_000, long: 40_000, xl: 40_000 },
  'gemini-2.5-flash':      { short: 40_000, medium: 40_000, long: 40_000, xl: 40_000 },
  'gemini-2.5-flash-lite': { short: 40_000, medium: 40_000, long: 40_000, xl: 40_000 },
  'gemini-2.0-flash':      { short: 40_000, medium: 40_000, long: 40_000, xl: 40_000 },
  'groq-llama-3.3-70b':  { short:  3_500, medium:  4_500, long:  5_500, xl:  4_500 },
  'groq-llama-3.1-8b':   { short:  1_800, medium:  2_200, long:  2_500, xl:  1_600 },
  'openrouter-free':     { short: 10_000, medium: 10_000, long: 10_000, xl: 10_000 },
  'mistral-small':       { short:  8_000, medium:  8_000, long:  8_000, xl:  8_000 },
  'github-gpt-4o-mini':  { short:  3_000, medium:  3_000, long:  3_000, xl:  3_000 },
  'github-llama-3.3-70b':{ short:  7_000, medium:  7_000, long:  7_000, xl:  7_000 },
};

const DEFAULT_TOKENS: TierBudget = { short: 8_000, medium: 8_000, long: 8_000, xl: 8_000 };
const CHARS_PER_TOKEN = 4;

const TRUNCATION_NOTE =
  '[NOTE: This is a truncated version of a longer document. Sections from the beginning, middle, and end are included. Generate comprehensive study materials covering all visible topics.]\n\n';

/**
 * Smart truncation: keep the first 30% and last 20% verbatim,
 * then sample evenly from the middle 50% so the AI sees full document scope.
 */
export function smartTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const budget = maxChars - TRUNCATION_NOTE.length - 200; // leave room for separators
  const headLen = Math.floor(budget * 0.30);
  const tailLen = Math.floor(budget * 0.20);
  const midLen = budget - headLen - tailLen;

  const head = text.slice(0, headLen);
  const tail = text.slice(text.length - tailLen);

  // Middle 50% of source, sampled in evenly-spaced chunks.
  const midStart = headLen;
  const midEnd = text.length - tailLen;
  const midSource = text.slice(midStart, midEnd);
  const sampleCount = 8;
  const chunkSize = Math.floor(midLen / sampleCount);
  const step = Math.floor(midSource.length / sampleCount);

  const midParts: string[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const s = i * step;
    midParts.push(midSource.slice(s, s + chunkSize));
  }

  return (
    TRUNCATION_NOTE +
    head +
    '\n\n[...middle sections sampled...]\n\n' +
    midParts.join('\n\n[...]\n\n') +
    '\n\n[...continuing to end...]\n\n' +
    tail
  );
}

export function truncateForModel(text: string, modelId: string, tier: Tier = 'medium'): string {
  const budget = TOKEN_BUDGETS[modelId] ?? DEFAULT_TOKENS;
  const tokens = budget[tier];
  const maxChars = tokens * CHARS_PER_TOKEN;

  if (text.length <= maxChars) {
    // Log even when no truncation happens — makes tier-aware budget behavior
    // visible in logs for sanity-checking.
    // eslint-disable-next-line no-console
    console.log(`[AI][truncate] model=${modelId} tier=${tier} original=${text.length} truncated=${text.length} budget_tok=${tokens} (no truncation)`);
    return text;
  }

  const out = smartTruncate(text, maxChars);
  // eslint-disable-next-line no-console
  console.log(`[AI][truncate] model=${modelId} tier=${tier} original=${text.length} truncated=${out.length} budget_tok=${tokens}`);
  return out;
}

/** Document-level check: was this PDF big enough that we'll truncate for all models? */
export function willTruncate(text: string): boolean {
  return text.length > 40_000 * CHARS_PER_TOKEN; // 160k chars
}
