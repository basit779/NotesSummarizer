/**
 * XL 2-pass orchestrator.
 *
 * Single-pass XL overflows Gemini's 8192 output cap — item arrays (especially
 * flashcards, which comes last in schema order) end up silently truncated when
 * the model writes long summaries or verbose items. Splitting generation into
 * two calls — notes half and practice half — gives each an independent 8192
 * budget with headroom.
 *
 * Execution is PARALLEL with a pass-2 timeout watchdog. Serial execution was
 * blowing Vercel's 60s serverless limit when both passes landed on Mistral
 * (~35s each = 70s total). Parallel + a 40s pass-2 ceiling keeps total wall
 * time bounded by max(pass1, 40s), fitting comfortably under 60s even on the
 * slowest fallback path.
 *
 * Each pass goes through runWithFallback independently — meaning pass 1 may
 * end up on Gemini and pass 2 may fall through to Mistral. That's fine; both
 * passes write into the same merged StudyMaterial.
 *
 * Schema split (post-rebalance): pass 1 carries summary + keyPoints +
 * definitions; pass 2 carries flashcards + examQuestions + topicConnections
 * + studyTips. Mistral pass 1 was hitting 7500-tok finish=length with 5
 * sections; 3/4 fits both under the cap.
 *
 * Failure semantics:
 *   - pass 1 failure → throw (core notes missing would be useless)
 *   - pass 2 failure OR timeout → return pass 1 + empty flashcards/exam
 *     arrays + undefined topicConnections/studyTips + degraded: true. Route
 *     layer surfaces degraded to the client toast.
 */

import { runWithFallback } from './runWithFallback';
import type { ModelId, ProviderResult, StudyMaterial } from './types';

interface AttemptedEntry { id: ModelId; error?: string }

export interface TwoPassResult extends ProviderResult {
  attempted: AttemptedEntry[];
  degraded: boolean;
  /** Non-null if pass 1 ran on a non-primary provider. Pass 2 is advisory only —
   *  notes half (pass 1) is the authoritative signal for user-visible quality. */
  fallbackUsed: string | null;
}

const PASS2_TIMEOUT_MS = 55_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} exceeded ${ms}ms timeout`));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export async function runTwoPassXL(
  text: string,
  plan: 'FREE' | 'PRO',
  preferredModel?: ModelId,
  pages?: number,
): Promise<TwoPassResult> {
  console.log(`[AI][2pass] strategy=parallel start — pages=${pages ?? '?'} chars=${text.length}`);

  const t0 = Date.now();

  const pass1Promise = runWithFallback(text, plan, preferredModel, pages, 1)
    .then((r) => { console.log(`[AI][2pass] ✓ pass 1 — model=${r.model} tokens=${r.tokensUsed} in ${Date.now() - t0}ms (keyPoints=${r.material.keyPoints.length} defs=${r.material.definitions.length})`); return r; });

  const pass2Promise = withTimeout(
    runWithFallback(text, plan, preferredModel, pages, 2),
    PASS2_TIMEOUT_MS,
    'pass 2',
  ).then((r) => { console.log(`[AI][2pass] ✓ pass 2 — model=${r.model} tokens=${r.tokensUsed} in ${Date.now() - t0}ms (flashcards=${r.material.flashcards.length} exam=${r.material.examQuestions.length})`); return r; });

  const [pass1Settled, pass2Settled] = await Promise.allSettled([pass1Promise, pass2Promise]);

  // Pass 1 is required — rethrow so the caller surfaces a normal error.
  if (pass1Settled.status === 'rejected') {
    throw pass1Settled.reason;
  }
  const pass1 = pass1Settled.value;

  let pass2Material: StudyMaterial | null = null;
  let pass2TokensUsed = 0;
  let pass2Model = '';
  const pass2Attempted: AttemptedEntry[] = [];
  let degraded = false;

  if (pass2Settled.status === 'fulfilled') {
    const pass2 = pass2Settled.value;
    pass2Material = pass2.material;
    pass2TokensUsed = pass2.tokensUsed;
    pass2Model = pass2.model;
    pass2Attempted.push(...pass2.attempted);
  } else {
    degraded = true;
    const msg = pass2Settled.reason instanceof Error ? pass2Settled.reason.message : String(pass2Settled.reason);
    const timedOut = /exceeded \d+ms timeout/.test(msg);
    console.log(`[AI][2pass] ✗ pass 2 ${timedOut ? 'TIMEOUT' : 'failed'} after ${Date.now() - t0}ms — returning notes-only with degraded=true. Error: ${msg}`);
  }

  console.log(`[AI][2pass] total=${Date.now() - t0}ms degraded=${degraded}`);

  const merged: StudyMaterial = {
    title: pass1.material.title,
    summary: pass1.material.summary,
    keyPoints: pass1.material.keyPoints,
    definitions: pass1.material.definitions,
    examQuestions: pass2Material?.examQuestions ?? [],
    flashcards: pass2Material?.flashcards ?? [],
    topicConnections: pass2Material?.topicConnections,
    studyTips: pass2Material?.studyTips,
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
    fallbackUsed: pass1.fallbackUsed,
  };
}
