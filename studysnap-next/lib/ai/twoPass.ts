/**
 * XL 2-pass orchestrator.
 *
 * Single-pass XL overflows Gemini's 8192 output cap — item arrays (especially
 * flashcards, which comes last in schema order) end up silently truncated when
 * the model writes long summaries or verbose items. Splitting generation into
 * two calls — notes half and practice half — gives each an independent 8192
 * budget with headroom.
 *
 * Execution is SERIAL: pass 2 does not start until pass 1 succeeds. Parallel
 * execution would double instantaneous rate-limit pressure on free-tier
 * providers, and the marginal latency win is ~8-12s which isn't worth the
 * reliability tradeoff.
 *
 * Each pass goes through runWithFallback independently — meaning pass 1 may
 * end up on Gemini and pass 2 may fall through to Groq if Gemini gets
 * rate-limited between passes. That's fine; both passes write into the same
 * merged StudyMaterial.
 *
 * Failure semantics: pass 1 failure → throw (no degraded mode; notes half
 * missing would be useless). Pass 2 failure → return pass 1 + empty
 * flashcards/exam arrays + degraded: true flag. Route layer surfaces the
 * degraded state to the client toast.
 */

import { runWithFallback } from './runWithFallback';
import type { ModelId, ProviderResult, StudyMaterial } from './types';

interface AttemptedEntry { id: ModelId; error?: string }

export interface TwoPassResult extends ProviderResult {
  attempted: AttemptedEntry[];
  degraded: boolean;
}

export async function runTwoPassXL(
  text: string,
  plan: 'FREE' | 'PRO',
  preferredModel?: ModelId,
  pages?: number,
): Promise<TwoPassResult> {
  console.log(`[AI][2pass] start — pages=${pages ?? '?'} chars=${text.length}`);

  // Pass 1 — notes half. Must succeed; if it fails, throw up the chain so the
  // caller surfaces a normal processing error.
  console.log(`[AI][2pass] pass 1 — summary + keyPoints + definitions + connections + tips`);
  const pass1 = await runWithFallback(text, plan, preferredModel, pages, 1);
  console.log(`[AI][2pass] ✓ pass 1 — model=${pass1.model} tokens=${pass1.tokensUsed} (keyPoints=${pass1.material.keyPoints.length} defs=${pass1.material.definitions.length})`);

  // Pass 2 — practice half. Swallow failures and degrade gracefully so the
  // user still gets the notes they paid latency for.
  let pass2Material: StudyMaterial | null = null;
  let pass2TokensUsed = 0;
  let pass2Model = '';
  const pass2Attempted: AttemptedEntry[] = [];
  let degraded = false;

  try {
    console.log(`[AI][2pass] pass 2 — flashcards + examQuestions`);
    const pass2 = await runWithFallback(text, plan, preferredModel, pages, 2);
    pass2Material = pass2.material;
    pass2TokensUsed = pass2.tokensUsed;
    pass2Model = pass2.model;
    pass2Attempted.push(...pass2.attempted);
    console.log(`[AI][2pass] ✓ pass 2 — model=${pass2.model} tokens=${pass2.tokensUsed} (flashcards=${pass2.material.flashcards.length} exam=${pass2.material.examQuestions.length})`);
  } catch (err) {
    degraded = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[AI][2pass] ✗ pass 2 failed — returning notes-only with degraded=true. Error: ${msg}`);
  }

  // Merge: pass 1 contributes notes half; pass 2 contributes practice half
  // (or empty arrays on failure).
  const merged: StudyMaterial = {
    title: pass1.material.title,
    summary: pass1.material.summary,
    keyPoints: pass1.material.keyPoints,
    definitions: pass1.material.definitions,
    topicConnections: pass1.material.topicConnections,
    studyTips: pass1.material.studyTips,
    examQuestions: pass2Material?.examQuestions ?? [],
    flashcards: pass2Material?.flashcards ?? [],
  };

  const modelLabel = degraded
    ? `${pass1.model} (pass2-failed)`
    : pass1.model === pass2Model
    ? `${pass1.model} ×2pass`
    : `${pass1.model} + ${pass2Model}`;

  return {
    material: merged,
    model: modelLabel,
    tokensUsed: pass1.tokensUsed + pass2TokensUsed,
    attempted: [...pass1.attempted, ...pass2Attempted],
    degraded,
  };
}
