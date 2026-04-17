import { env } from '../env';
import { geminiProvider } from './providers/gemini';
import { openaiCompat } from './providers/openaiCompat';
import { ModelId, ProviderFn } from './types';
import { truncateForModel } from './truncate';

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
const OUTPUT_CAPS: Record<string, number> = {
  'groq-llama-3.3-70b': 8192,
  'groq-llama-3.1-8b': 8192,
  'openrouter-deepseek': 4096,
  'mistral-small': 4096,
  'github-gpt-4o-mini': 3500,
  'github-llama-3.3-70b': 4096,
};

export const MODEL_REGISTRY: Record<ModelId, ModelSpec> = {
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'google',
    run: (text, plan, opts) => geminiProvider('gemini-2.5-pro', truncateForModel(text, 'gemini-2.5-pro'), plan, opts),
    isConfigured: () => Boolean(env.googleApiKey),
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'google',
    run: (text, plan, opts) => geminiProvider('gemini-2.0-flash', truncateForModel(text, 'gemini-2.0-flash'), plan, opts),
    isConfigured: () => Boolean(env.googleApiKey),
  },
  'groq-llama-3.3-70b': {
    id: 'groq-llama-3.3-70b', label: 'Llama 3.3 70B', provider: 'groq',
    run: (text, plan, opts) => openaiCompat({
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: env.groqApiKey,
      modelName: 'llama-3.3-70b-versatile',
      displayName: 'Groq Llama 3.3 70B',
      text: truncateForModel(text, 'groq-llama-3.3-70b'), plan,
      minimal: opts?.minimal,
      maxOutputTokens: OUTPUT_CAPS['groq-llama-3.3-70b'],
    }),
    isConfigured: () => Boolean(env.groqApiKey),
  },
  'groq-llama-3.1-8b': {
    id: 'groq-llama-3.1-8b', label: 'Llama 3.1 8B Instant', provider: 'groq',
    run: (text, plan, opts) => openaiCompat({
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: env.groqApiKey,
      modelName: 'llama-3.1-8b-instant',
      displayName: 'Groq Llama 3.1 8B',
      text: truncateForModel(text, 'groq-llama-3.1-8b'), plan,
      minimal: opts?.minimal,
      maxOutputTokens: OUTPUT_CAPS['groq-llama-3.1-8b'],
    }),
    isConfigured: () => Boolean(env.groqApiKey),
  },
  'openrouter-deepseek': {
    id: 'openrouter-deepseek', label: 'DeepSeek V3 (free)', provider: 'openrouter',
    run: (text, plan, opts) => openaiCompat({
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: env.openrouterApiKey,
      modelName: 'deepseek/deepseek-chat-v3.1:free',
      displayName: 'OpenRouter DeepSeek',
      text: truncateForModel(text, 'openrouter-deepseek'), plan,
      extraHeaders: { 'HTTP-Referer': env.appUrl, 'X-Title': 'StudySnap AI' },
      minimal: opts?.minimal,
      maxOutputTokens: OUTPUT_CAPS['openrouter-deepseek'],
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
      text: truncateForModel(text, 'mistral-small'), plan,
      minimal: opts?.minimal,
      maxOutputTokens: OUTPUT_CAPS['mistral-small'],
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
      text: truncateForModel(text, 'github-gpt-4o-mini'), plan,
      minimal: true,
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
      text: truncateForModel(text, 'github-llama-3.3-70b'), plan,
      minimal: opts?.minimal,
      maxOutputTokens: OUTPUT_CAPS['github-llama-3.3-70b'],
    }),
    isConfigured: () => Boolean(env.githubToken),
  },
};

/**
 * Cross-provider fallback chain. Invisible to the user. No picker UI.
 * Ordered so consecutive attempts hit DIFFERENT organizations — Groq's
 * free-tier TPM is a single org-wide bucket shared across all its models,
 * so putting two Groq models back-to-back doubles-up the rate-limit risk.
 *
 * runWithFallback filters by isConfigured() and caps at MAX_ATTEMPTS=3,
 * so users with only GOOGLE_API_KEY + GROQ_API_KEY still get a sane chain.
 *
 *   1. gemini-2.0-flash      — Google. 1M ctx, 8k output. 15 RPM / 1M TPM / 1500 RPD free.
 *   2. groq-llama-3.3-70b    — Groq. 128k ctx, 8k output. 30 RPM / 12k TPM.
 *   3. openrouter-deepseek   — OpenRouter. Different org from Groq; separate TPM bucket.
 *   4. mistral-small         — Mistral. Yet another org. Final safety net.
 *   5. groq-llama-3.1-8b     — Only tried if nothing else is configured (same-org risk).
 *
 * github-gpt-4o-mini is excluded: its 8k TOTAL context cap 413s on realistic inputs.
 */
export const DEFAULT_FALLBACK_ORDER: ModelId[] = [
  'gemini-2.0-flash',
  'groq-llama-3.3-70b',
  'openrouter-deepseek',
  'mistral-small',
  'groq-llama-3.1-8b',
];

export function listConfiguredModels(): ModelSpec[] {
  return Object.values(MODEL_REGISTRY).filter((m) => m.isConfigured());
}
