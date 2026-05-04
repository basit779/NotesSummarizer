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
const MISTRAL_PASS_CAPS: Record<1 | 2, number> = { 1: 6500, 2: 7500 };

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
      apiKey: process.env.DEEPSEEK_API_KEY,
      modelName: 'deepseek-v4-flash',
      displayName: 'DeepSeek V4 Flash',
      text: truncateForModel(text, 'deepseek-v4-flash', selectTier(text.length, opts?.pages)), plan,
      supportsJsonSchema: false,
      minimal: opts?.minimal,
      ultraMinimal: opts?.ultraMinimal,
      pages: opts?.pages,
      pass: opts?.pass,
      timeoutMs: opts?.timeoutMs,
      // Pass-call output cap: 4000 tokens hard ceiling (vs 8192 for non-pass).
      // Belt-and-suspenders alongside ultraMinimal — even if the prompt's
      // smaller targets are ignored, the model can't generate more than 4K
      // tokens. At DeepSeek's 50-80 tok/s, 4K tokens = 50-80s, fits 55s most
      // of the time. Without this cap, pass1 was hitting 55s timeout on
      // 4-page docs (run 01KQQE... 2026-05-04) because the model targeted
      // ~3K tokens but generated more.
      maxOutputTokens: opts?.pass ? 4000 : OUTPUT_CAPS['deepseek-v4-flash'],
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
    isConfigured: () => !!process.env.DEEPSEEK_API_KEY,
  },
};

/**
 * Cross-provider fallback chain. Invisible to the user. No picker UI.
 *
 * Gemini primary, DeepSeek as paid backup with 2-pass parallel orchestration:
 *   1. gemini-2.5-flash   — Free primary. ~5-30s typical, top quality, serves
 *                           the bulk of uploads while quota is healthy
 *                           (250 RPD, 10 RPM free tier).
 *   2. deepseek-v4-flash  — Paid backup ($4). When Gemini rate-limits or
 *                           errors out, DeepSeek fires. For medium+ docs the
 *                           Inngest orchestrator (lib/inngest.ts) splits
 *                           DeepSeek into PARALLEL pass1 + pass2 Inngest steps,
 *                           each in its own 60s function invocation, so
 *                           DeepSeek finishes for any doc size despite Hobby's
 *                           60s wall. Short docs use single-pass DeepSeek.
 *   3. groq-llama-3.3-70b — Reliable safety net (~15s LPU). Tight 12K TPM cap
 *                           → 3K input / 6K output.
 *   4. mistral-small      — Last resort. 500K TPM, generous output.
 *
 * Why this order:
 *   - Gemini quality is the best free option; using it primary means default
 *     uploads get the best output without spending the $4 budget.
 *   - DeepSeek as backup means the $4 lasts 3-5x longer (only fires when
 *     Gemini fails) AND with 2-pass orchestration the $4 actually delivers
 *     when called — no more wasted aborts.
 *   - Both providers earn their keep: Gemini handles ~80%, DeepSeek catches
 *     ~15-20% (rate-limit days, dev testing, traffic spikes).
 *
 * Registered but NOT in active chains (kept for future use):
 *   - gemini-2.5-pro / -flash-lite / 2.0-flash — variant-of-primary, redundant.
 *   - openrouter-free                           — auto-router was inconsistent.
 *   - groq-llama-3.1-8b                         — too tight a TPM budget.
 *   - github-* models                           — 8K total context cap 413s.
 *
 * Per-provider step orchestration (lib/inngest.ts) means each entry runs in
 * its own Vercel function, so worst-case = N × ~60s across N steps. Inngest
 * checkpoints between steps so failed providers don't re-burn quota on retry.
 */
export const DEFAULT_FALLBACK_ORDER: ModelId[] = [
  'gemini-2.5-flash',
  'deepseek-v4-flash',
  'groq-llama-3.3-70b',
  'mistral-small',
];

const XL_FALLBACK_ORDER: ModelId[] = [
  'gemini-2.5-flash',
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
