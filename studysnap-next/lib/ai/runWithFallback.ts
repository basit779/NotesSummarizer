import { DEFAULT_FALLBACK_ORDER, MODEL_REGISTRY } from './registry';
import { ModelId, PermanentAIError, ProviderResult, TransientAIError } from './types';
import { HttpError } from '../httpError';

export async function runWithFallback(
  text: string,
  plan: 'FREE' | 'PRO',
  preferred?: ModelId,
): Promise<ProviderResult & { attempted: { id: ModelId; error?: string }[] }> {
  const chain: ModelId[] = [];
  if (preferred && MODEL_REGISTRY[preferred]) chain.push(preferred);
  for (const id of DEFAULT_FALLBACK_ORDER) {
    if (!chain.includes(id)) chain.push(id);
  }

  const configured = chain.filter((id) => MODEL_REGISTRY[id].isConfigured());
  if (configured.length === 0) {
    throw new HttpError(
      503,
      'NO_AI_PROVIDER',
      'No AI provider configured. Set at least one of: GOOGLE_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY.',
    );
  }

  const attempted: { id: ModelId; error?: string }[] = [];
  let lastError: Error | undefined;

  for (const id of configured) {
    const spec = MODEL_REGISTRY[id];
    try {
      const result = await spec.run(text, plan);
      attempted.push({ id });
      return { ...result, attempted };
    } catch (err: any) {
      if (err instanceof PermanentAIError) {
        throw new HttpError(400, err.code, err.message);
      }
      const msg = err instanceof TransientAIError ? `${err.code}: ${err.message}` : String(err?.message ?? err);
      attempted.push({ id, error: msg });
      lastError = err;
    }
  }

  throw new HttpError(
    502,
    'ALL_PROVIDERS_FAILED',
    `All ${configured.length} AI providers failed. Last error: ${lastError?.message ?? 'unknown'}`,
  );
}
