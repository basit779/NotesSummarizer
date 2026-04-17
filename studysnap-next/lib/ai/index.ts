import { HttpError } from '../httpError';
import { runWithFallback } from './runWithFallback';
import type { ModelId, StudyMaterial } from './types';

export type { StudyMaterial, ModelId } from './types';
export { MODEL_REGISTRY, listConfiguredModels } from './registry';

/**
 * Hard cap on input chars before per-model truncation kicks in. Smaller for FREE
 * so Gemini's 4096-token output ceiling has enough headroom for the full schema.
 */
const MAX_CHARS_FREE = 45_000;
const MAX_CHARS_PRO = 60_000;

export async function analyzeText(
  rawText: string,
  plan: 'FREE' | 'PRO',
  preferredModel?: ModelId,
): Promise<{ material: StudyMaterial; model: string; tokensUsed: number; attempted: { id: ModelId; error?: string }[] }> {
  const cap = plan === 'PRO' ? MAX_CHARS_PRO : MAX_CHARS_FREE;
  const trimmed = rawText.length > cap ? rawText.slice(0, cap) : rawText;
  if (trimmed.trim().length < 50) {
    throw new HttpError(400, 'EMPTY_SOURCE', 'The document did not contain enough extractable text.');
  }
  return runWithFallback(trimmed, plan, preferredModel);
}
