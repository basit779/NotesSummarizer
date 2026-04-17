import { HttpError } from '../httpError';
import { runWithFallback } from './runWithFallback';
import type { ModelId, StudyMaterial } from './types';

export type { StudyMaterial, ModelId } from './types';
export { MODEL_REGISTRY, listConfiguredModels } from './registry';

/**
 * Pre-truncate oversized inputs before they reach any provider. Per-model
 * caps in truncate.ts handle tighter constraints; this is just the floor.
 * 120k chars ≈ 30k tokens of text — comfortably inside Gemini's 1M context
 * and leaves ~40k tokens of headroom for system prompt + schema + 8k output.
 */
const MAX_CHARS = 120_000;

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
