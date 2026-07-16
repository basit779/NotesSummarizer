import { env } from '../env';
import { geminiProvider } from './providers/gemini';
import { openaiCompat } from './providers/openaiCompat';
import { ModelId, ProviderFn } from './types';
import { truncateForModel } from './truncate';
import { selectTier, type Tier } from '../prompts';

export interface ModelSpec {
  id: ModelId;
  label: string;
  provider: string;
  run: ProviderFn;
  isConfigured: () => boolean;
}

/**
 * Per-provider completion-token caps. These reflect the ACTUAL usable
 * output ceiling on each provider (free tier), so a single call always
 * fits the full schema and never returns truncated JSON that would
 * cascade through the fallback chain.
 *
 * GitHub gpt-4o-mini has 8k TOTAL context (input+output) — if used, we
 * also have to truncate input aggressively. It's excluded from the
 * default fallback for that reason.
 */
/**
 * Completion-token caps sized to fit each free-tier TPM / context limit with
 * slack for the rolling-minute window. Groq is especially tight — 12k TPM for
 * 70B and 6k for 8B means each call's total (input + output) must stay well
 * under that, or a single request 429s.
 */
const OUTPUT_CAPS: Record<string, number> = {
  // Groq 70B: max completion is 32K, but 12K TPM free tier is the binding
  // constraint. Pairs with 3K input cap in truncate.ts:
  //   3K input + 6K output + ~2.5K overhead = 11.5K, leaves 500 tok margin
  //   under the 12K TPM cap — safe against overhead variance.
  // Tradeoff: with TIER_COUNTS medium asking for 14-26 flashcards, 6K output
  // typically yields ~22-24 visible cards (lower-bound of requested range).
  // Acceptable because Groq is now chain position 3 — Gemini/DeepSeek serve
  // most requests with the full 14-26 range; Groq only fires as a fallback.
  'groq-llama-3.3-70b': 6000,
  'groq-llama-3.1-8b': 2500,
  'openrouter-free': 4096,
  'mistral-small': 7500,
  'github-gpt-4o-mini': 3500,
  'github-llama-3.3-70b': 4096,
  // DeepSeek V4-Flash supports much higher, but 8192 matches the schema's
  // realistic max output and keeps parity with other primary-class providers.
  'deepseek-v4-flash': 8192,
};

/**
 * Per-pass override for Mistral on XL 2-pass. Pass 1 (summary + keyPoints +
 * definitions) hits the 7500 cap with finish=length; 6500 forces the model
 * to stay concise. Pass 2 keeps 7500 since flashcards + MCQs + secondary
 * sections use nearly all of it without truncating.
 */
const MISTRAL_PASS_CAPS: Record<number, number> = { 1: 6500, 2: 7500, 3: 7500, 4: 7500 };

export const MODEL_REGISTRY: Record<ModelId, ModelSpec> = {
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'google',
    run: (text, plan, opts) => geminiProvider('gemini-2.5-pro', truncateForModel(text, 'gemini-2.5-pro', selectTier(text.length, opts?.pages)), plan, opts),
    isConfigured: () => Boolean(env.googleApiKey),
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google',
    run: (text, plan, opts) => geminiProvider('gemini-2.5-flash', truncateForModel(text, 'gemini-2.5-flash', selectTier(text.length, opts?.pages)), plan, opts),
    isConfigured: () => Boolean(env.googleApiKey),
  },
  'gemini-2.5-flash-lite': {
    id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', provider: 'google',
    run: (text, plan, opts) => geminiProvider('gemini-2.5-flash-lite', truncateForModel(text, 'gemini-2.5-flash-lite', selectTier(text.length, opts?.pages)), plan, opts),
    isConfigured: () => Boolean(env.googleApiKey),
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'google',
    run: (text, plan, opts) => geminiProvider('gemini-2.0-flash', truncateForModel(text, 'gemini-2.0-flash', selectTier(text.length, opts?.pages)), plan, opts),
    isConfigured: () => Boolean(env.googleApiKey),
  },
  'groq-llama-3.3-70b': {
    id: 'groq-llama-3.3-70b', label: 'Llama 3.3 70B', provider: 'groq',
    // Groq free tier is 12,000 TPM — force minimal prompt so output fits
    // alongside input inside a single-minute window.
    run: (text, plan, opts) => openaiCompat({
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: env.groqApiKey,
      modelName: 'llama-3.3-70b-versatile',
      displayName: 'Groq Llama 3.3 70B',
      text: truncateForModel(text, 'groq-llama-3.3-70b', selectTier(text.length, opts?.pages)), plan,
      minimal: true,
      pages: opts?.pages,
      pass: opts?.pass,
      timeoutMs: opts?.timeoutMs,
      maxOutputTokens: OUTPUT_CAPS['groq-llama-3.3-70b'],
    }),
    isConfigured: () => Boolean(env.groqApiKey),
  },
  'groq-llama-3.1-8b': {
    id: 'groq-llama-3.1-8b', label: 'Llama 3.1 8B Instant', provider: 'groq',
    // Groq 8B free tier is 6,000 TPM — tightest budget. Always minimal.
    run: (text, plan, opts) => openaiCompat({
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: env.groqApiKey,
      modelName: 'llama-3.1-8b-instant',
      displayName: 'Groq Llama 3.1 8B',
      text: truncateForModel(text, 'groq-llama-3.1-8b', selectTier(text.length, opts?.pages)), plan,
      minimal: true,
      pages: opts?.pages,
      pass: opts?.pass,
      timeoutMs: opts?.timeoutMs,
      maxOutputTokens: OUTPUT_CAPS['groq-llama-3.1-8b'],
    }),
    isConfigured: () => Boolean(env.groqApiKey),
  },
  'openrouter-free': {
    id: 'openrouter-free', label: 'OpenRouter Free (auto)', provider: 'openrouter',
    // `openrouter/free` auto-routes to any available free model on OpenRouter
    // (DeepSeek, Qwen, Meta, etc.). Resilient to individual model sunsets —
    // previously pinned to deepseek/deepseek-chat-v3.1:free which 404'd when
    // DeepSeek V3.2 shipped and V3.1 was retired.
    run: (text, plan, opts) => openaiCompat({
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: env.openrouterApiKey,
      modelName: 'openrouter/free',
      displayName: 'OpenRouter Free',
      text: truncateForModel(text, 'openrouter-free', selectTier(text.length, opts?.pages)), plan,
      extraHeaders: { 'HTTP-Referer': env.appUrl, 'X-Title': 'StudySnap AI' },
      minimal: opts?.minimal,
      pages: opts?.pages,
      pass: opts?.pass,
      timeoutMs: opts?.timeoutMs,
      maxOutputTokens: OUTPUT_CAPS['openrouter-free'],
    }),
    isConfigured: () => Boolean(env.openrouterApiKey),
  },
  'mistral-small': {
    id: 'mistral-small', label: 'Mistral Small', provider: 'mistral',
    run: (text, plan, opts) => openaiCompat({
      baseUrl: 'https://api.mistral.ai/v1',
      apiKey: env.mistralApiKey,
      modelName: 'mistral-small-latest',
      displayName: 'Mistral Small',
      text: truncateForModel(text, 'mistral-small', selectTier(text.length, opts?.pages)), plan,
      minimal: opts?.minimal,
      pages: opts?.pages,
      pass: opts?.pass,
      timeoutMs: opts?.timeoutMs,
      maxOutputTokens: opts?.pass ? MISTRAL_PASS_CAPS[opts.pass] : OUTPUT_CAPS['mistral-small'],
    }),
    isConfigured: () => Boolean(env.mistralApiKey),
  },
  'github-gpt-4o-mini': {
    id: 'github-gpt-4o-mini', label: 'GPT-4o mini (GitHub)', provider: 'github',
    // GitHub gpt-4o-mini has an 8k TOTAL context cap. Force minimal prompt
    // and a 3.5k output ceiling to stay inside that window.
    run: (text, plan, opts) => openaiCompat({
      baseUrl: 'https://models.inference.ai.azure.com',
      apiKey: env.githubToken,
      modelName: 'gpt-4o-mini',
      displayName: 'GitHub GPT-4o mini',
      text: truncateForModel(text, 'github-gpt-4o-mini', selectTier(text.length, opts?.pages)), plan,
      minimal: true,
      pages: opts?.pages,
      pass: opts?.pass,
      timeoutMs: opts?.timeoutMs,
      maxOutputTokens: OUTPUT_CAPS['github-gpt-4o-mini'],
    }),
    isConfigured: () => Boolean(env.githubToken),
  },
  'github-llama-3.3-70b': {
    id: 'github-llama-3.3-70b', label: 'Llama 3.3 70B (GitHub)', provider: 'github',
    run: (text, plan, opts) => openaiCompat({
      baseUrl: 'https://models.inference.ai.azure.com',
      apiKey: env.githubToken,
      modelName: 'Llama-3.3-70B-Instruct',
      displayName: 'GitHub Llama 3.3 70B',
      text: truncateForModel(text, 'github-llama-3.3-70b', selectTier(text.length, opts?.pages)), plan,
      minimal: opts?.minimal,
      pages: opts?.pages,
      pass: opts?.pass,
      timeoutMs: opts?.timeoutMs,
      maxOutputTokens: OUTPUT_CAPS['github-llama-3.3-70b'],
    }),
    isConfigured: () => Boolean(env.githubToken),
  },
  'deepseek-v4-flash': {
    id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', provider: 'deepseek',
    // V4-Flash defaults to thinking mode which breaks JSON output and burns
    // extra tokens. extraBody disables it. supportsJsonSchema:false strips
    // response_format — V4-Flash silently re-enables thinking when JSON mode
    // is requested; the system prompt + schema validators handle JSON output.
    run: (text, plan, opts) => openaiCompat({
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: env.deepseekApiKey,
      modelName: 'deepseek-v4-flash',
      displayName: 'DeepSeek V4 Flash',
      text: truncateForModel(text, 'deepseek-v4-flash', selectTier(text.length, opts?.pages)), plan,
      supportsJsonSchema: false,
      minimal: opts?.minimal,
      ultraMinimal: opts?.ultraMinimal,
      pages: opts?.pages,
      pass: opts?.pass,
      timeoutMs: opts?.timeoutMs,
      // Pass-call output cap: 2400 tokens hard ceiling (vs 8192 for non-pass).
      // Belt-and-suspenders alongside the pass prompts' targets — even if the
      // requested counts are ignored, the model physically can't generate more
      // than 2400 tokens = 30-48s at DeepSeek's 50-80 tok/s, which always fits
      // the 50s per-step timeout. The 3-way split (passes 1/3/4 in
      // lib/inngest.ts) targets ~1.5-1.8K tokens per pass, so this cap only
      // bites on over-generation. History: the old 2-pass design needed a
      // 3500 cap + ultraMinimal (0.5×) counts and pass1 STILL grazed the
      // timeout (run 01KR67K3R7Y0SE6XHDNM0AEYNM); splitting the payload three
      // ways is what buys both fuller counts and bigger timeout margin.
      // Single-pass minimal (short-tier docs from the Inngest orchestrator):
      // 2600 cap = 33-52s at 50-80 tok/s, fits the 55s step timeout. The
      // unrestrained 8192 cap allowed over-generation up to ~164s — a
      // guaranteed timeout that then dumped the upload to Groq/llama.
      maxOutputTokens: opts?.pass ? 2400
        : opts?.minimal || opts?.ultraMinimal ? 2600
        : OUTPUT_CAPS['deepseek-v4-flash'],
      // Two thinking-disable flags sent in parallel:
      //   - `thinking: {type: disabled}` — V4-Flash documented format
      //   - `chat_template_kwargs.thinking: false` — V3.1 / vLLM-hosted format
      // V4-Flash honors the first; vLLM-hosted variants honor the second.
      // Either way, no thinking tokens. Unknown fields are ignored upstream.
      extraBody: {
        thinking: { type: 'disabled' },
        chat_template_kwargs: { thinking: false },
      },
    }),
    isConfigured: () => Boolean(env.deepseekApiKey),
  },
};

/**
 * Cross-provider fallback chain. Invisible to the user. No picker UI.
 *
 * STACKED GEMINI FAMILY FIRST. This is the key to NOT always falling through
 * to Groq/llama. Google's free-tier quotas are PER MODEL — each Gemini variant
 * has its own independent RPM/RPD bucket, all on the same GOOGLE_API_KEY:
 *   1. gemini-2.5-flash      — best quality. ~250 RPD, 10 RPM.
 *   2. gemini-2.5-flash-lite — same 2.5 family, near-equal quality, FAST.
 *                              ~1000 RPD (highest free quota) — the workhorse
 *                              fallback that catches 2.5-flash's quota wall.
 *   3. gemini-2.0-flash      — solid. ~200 RPD, separate bucket again.
 *   --- combined ~1450 Gemini-quality requests/day before any non-Gemini ---
 *   4. deepseek-v4-flash     — Paid backup ($4). Fires only when ALL Gemini
 *                              quota is exhausted. Medium+ docs use the 2-pass
 *                              parallel Inngest orchestration (lib/inngest.ts)
 *                              so it fits Hobby's 60s wall. Short docs single-pass.
 *   5. groq-llama-3.3-70b    — Fast safety net (~15s LPU) when even DeepSeek
 *                              fails/times out. Lower quality but always finishes.
 *   6. mistral-small         — Last resort. 500K TPM.
 *
 * Why this order:
 *   - The OLD chain (gemini-2.5-flash → deepseek → groq) fell through to Groq
 *     constantly during heavy testing: one Gemini model's 250 RPD burns fast,
 *     then DeepSeek is slow/flaky on Hobby, so Groq mopped up = "always llama".
 *   - Stacking 3 Gemini variants (3 independent quotas) means Gemini-quality
 *     serves virtually every upload before anything weaker is reached.
 *   - DeepSeek stays in as the paid insurance it was meant to be: it fires when
 *     Google is genuinely exhausted/down, and Groq still catches its failures.
 *
 * Registered but NOT in active chains:
 *   - gemini-2.5-pro     — stricter free quota than flash; flash family is plenty.
 *   - openrouter-free    — auto-router was inconsistent.
 *   - groq-llama-3.1-8b  — too tight a TPM budget.
 *   - github-* models    — 8K total context cap 413s.
 *
 * Per-provider step orchestration (lib/inngest.ts) means each entry runs in
 * its own Vercel function, so worst-case = N × ~60s across N steps. Inngest
 * checkpoints between steps so failed providers don't re-burn quota on retry.
 */
export const DEFAULT_FALLBACK_ORDER: ModelId[] = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'deepseek-v4-flash',
  'groq-llama-3.3-70b',
  'mistral-small',
];

// XL uses the same stacked-Gemini order. Gemini 2.5/2.0 Flash all have 1M
// context so large single-call docs fit; the >120K chunked path (runWithFallback)
// skips DeepSeek since its 50-80 tok/s can't finish inside that path's 25s budget.
const XL_FALLBACK_ORDER: ModelId[] = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'deepseek-v4-flash',
  'groq-llama-3.3-70b',
  'mistral-small',
];

export function getFallbackOrder(tier: Tier): ModelId[] {
  return tier === 'xl' ? XL_FALLBACK_ORDER : DEFAULT_FALLBACK_ORDER;
}

export function listConfiguredModels(): ModelSpec[] {
  return Object.values(MODEL_REGISTRY).filter((m) => m.isConfigured());
}
