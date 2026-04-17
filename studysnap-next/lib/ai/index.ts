import { HttpError } from '../httpError';
import { analyzeChunked, type ChunkedResult } from './chunked';
import type { ModelId } from './types';

export type { StudyMaterial, ModelId } from './types';
export { MODEL_REGISTRY, listConfiguredModels } from './registry';
export type { ChunkedResult } from './chunked';

/**
 * Absolute safety cap on input bytes. 500k chars ≈ 125k tokens ≈ ~120 pages
 * of dense text. The chunker splits anything > 120k chars into up to 3
 * parallel runs of ~100k chars each, so one upload uses at most 3 API calls.
 */
const ABSOLUTE_MAX_CHARS = 500_000;

export async function analyzeText(
  rawText: string,
  plan: 'FREE' | 'PRO',
  preferredModel?: ModelId,
): Promise<ChunkedResult> {
  const trimmed = rawText.length > ABSOLUTE_MAX_CHARS ? rawText.slice(0, ABSOLUTE_MAX_CHARS) : rawText;
  if (trimmed.trim().length < 50) {
    throw new HttpError(400, 'EMPTY_SOURCE', 'The document did not contain enough extractable text.');
  }
  return analyzeChunked(trimmed, plan, preferredModel);
}
