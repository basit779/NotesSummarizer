import { env } from '../../config/env';
import { geminiProvider } from './providers/gemini';
import { openaiCompat } from './providers/openaiCompat';
import { ModelId, ProviderFn } from './types';

export interface ModelSpec {
  id: ModelId;
  label: string;
  provider: string;
  run: ProviderFn;
  isConfigured: () => boolean;
}

export const MODEL_REGISTRY: Record<ModelId, ModelSpec> = {
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'google',
    run: (text, plan) => geminiProvider('gemini-2.5-pro', text, plan),
    isConfigured: () => Boolean(env.googleApiKey),
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'google',
    run: (text, plan) => geminiProvider('gemini-2.0-flash', text, plan),
    isConfigured: () => Boolean(env.googleApiKey),
  },
  'groq-llama-3.3-70b': {
    id: 'groq-llama-3.3-70b',
    label: 'Llama 3.3 70B',
    provider: 'groq',
    run: (text, plan) => openaiCompat({
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: env.groqApiKey,
      modelName: 'llama-3.3-70b-versatile',
      displayName: 'Groq Llama 3.3 70B',
      text, plan,
    }),
    isConfigured: () => Boolean(env.groqApiKey),
  },
  'groq-llama-3.1-8b': {
    id: 'groq-llama-3.1-8b',
    label: 'Llama 3.1 8B Instant',
    provider: 'groq',
    run: (text, plan) => openaiCompat({
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: env.groqApiKey,
      modelName: 'llama-3.1-8b-instant',
      displayName: 'Groq Llama 3.1 8B',
      text, plan,
    }),
    isConfigured: () => Boolean(env.groqApiKey),
  },
  'openrouter-deepseek': {
    id: 'openrouter-deepseek',
    label: 'DeepSeek V3 (free)',
    provider: 'openrouter',
    run: (text, plan) => openaiCompat({
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: env.openrouterApiKey,
      modelName: 'deepseek/deepseek-chat-v3.1:free',
      displayName: 'OpenRouter DeepSeek',
      text, plan,
      extraHeaders: {
        'HTTP-Referer': env.appUrl,
        'X-Title': 'StudySnap AI',
      },
    }),
    isConfigured: () => Boolean(env.openrouterApiKey),
  },
  'mistral-small': {
    id: 'mistral-small',
    label: 'Mistral Small',
    provider: 'mistral',
    run: (text, plan) => openaiCompat({
      baseUrl: 'https://api.mistral.ai/v1',
      apiKey: env.mistralApiKey,
      modelName: 'mistral-small-latest',
      displayName: 'Mistral Small',
      text, plan,
    }),
    isConfigured: () => Boolean(env.mistralApiKey),
  },
};

/**
 * Default fallback order when no explicit model requested, or when the
 * requested model fails. Priority: flagship quality first, then fast fallbacks.
 */
export const DEFAULT_FALLBACK_ORDER: ModelId[] = [
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'groq-llama-3.3-70b',
  'openrouter-deepseek',
  'mistral-small',
  'groq-llama-3.1-8b',
];

export function listConfiguredModels(): ModelSpec[] {
  return Object.values(MODEL_REGISTRY).filter((m) => m.isConfigured());
}
