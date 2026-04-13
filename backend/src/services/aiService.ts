/**
 * AI service facade. Delegates to the multi-provider registry with automatic
 * rate-limit fallback. Public API unchanged from the original Claude-only version.
 */

import { HttpError } from '../utils/httpError';
import { runWithFallback } from './ai/runWithFallback';
import { MODEL_REGISTRY, listConfiguredModels } from './ai/registry';
import type { ModelId, StudyMaterial } from './ai/types';

export type { StudyMaterial, ModelId } from './ai/types';
export { MODEL_REGISTRY, listConfiguredModels };

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
