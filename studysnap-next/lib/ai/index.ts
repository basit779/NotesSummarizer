import { HttpError } from '../httpError';
import { runWithFallback } from './runWithFallback';
import type { ModelId, StudyMaterial } from './types';

export type { StudyMaterial, ModelId } from './types';
export { MODEL_REGISTRY, listConfiguredModels } from './registry';

const MAX_CHARS = 60_000;

export async function analyzeText(
  rawText: string,
  plan: 'FREE' | 'PRO',
  preferredModel?: ModelId,
): Promise<{ material: StudyMaterial; model: string; tokensUsed: number; attempted: { id: ModelId; error?: string }[] }> {
  const trimmed = rawText.length > MAX_CHARS ? rawText.slice(0, MAX_CHARS) : rawText;
  if (trimmed.trim().length < 50) {
    throw new HttpError(400, 'EMPTY_SOURCE', 'The document did not contain enough extractable text.');
  }
  return runWithFallback(trimmed, plan, preferredModel);
}
