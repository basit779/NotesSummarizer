import { runWithFallback } from './runWithFallback';
import { runTwoPassXL } from './twoPass';
import { selectTier } from '../prompts';
import type { ModelId, ProviderResult, StudyMaterial } from './types';

const CHUNK_CHAR_BUDGET = 100_000;   // ~25k tokens — single-call friendly for Gemini 2.0 Flash
const MAX_CHUNKS = 3;                // hard cap — bounds cost + fits 60s route timeout
const CHUNK_THRESHOLD = 120_000;     // anything over this gets chunked

interface AttemptedEntry { id: ModelId; error?: string }

export interface ChunkedResult {
  material: StudyMaterial;
  model: string;
  tokensUsed: number;
  attempted: AttemptedEntry[];
  chunks: number;          // how many chunks were processed (1 = no chunking)
  sourceChars: number;     // total chars actually covered by the AI
  /** True if XL 2-pass pass-2 failed — notes half present, practice half empty. */
  degraded?: boolean;
}

/**
 * Entry point. Chooses single-call or chunked based on input length.
 * - Up to CHUNK_THRESHOLD chars: single AI call (fastest, best quality).
 * - Beyond: splits into up to MAX_CHUNKS ~CHUNK_CHAR_BUDGET-sized pieces,
 *   runs all in parallel, and merges the resulting study packs.
 *
 * With MAX_CHUNKS=3 at 100k chars each, we cover up to ~300k chars — roughly
 * 75 pages of dense text. Beyond that we tail-pack into the last chunk so
 * the user still gets end-of-document coverage.
 */
export async function analyzeChunked(
  rawText: string,
  plan: 'FREE' | 'PRO',
  preferredModel?: ModelId,
  pages?: number,
): Promise<ChunkedResult> {
  if (rawText.length <= CHUNK_THRESHOLD) {
    // XL tier (page-heavy or char-heavy) — split generation into notes and
    // practice halves so each has the full 8192 budget. Gated to the
    // single-call path on purpose: chunked runs already split output across
    // multiple packs, and 2-pass per chunk would 4× the API calls on free tier.
    const tier = selectTier(rawText.length, pages);
    if (tier === 'xl') {
      const r = await runTwoPassXL(rawText, plan, preferredModel, pages);
      return {
        material: r.material,
        model: r.model,
        tokensUsed: r.tokensUsed,
        attempted: r.attempted,
        chunks: 1,
        sourceChars: rawText.length,
        degraded: r.degraded,
      };
    }
    const r = await runWithFallback(rawText, plan, preferredModel, pages);
    return { ...r, chunks: 1, sourceChars: rawText.length };
  }

  const chunks = splitIntoChunks(rawText, CHUNK_CHAR_BUDGET, MAX_CHUNKS);
  console.log(`[AI][chunked] ${rawText.length} chars → ${chunks.length} chunks of [${chunks.map((c) => c.length).join(', ')}]`);

  // Per-chunk page count = proportional share of total. Each chunk sizes its
  // own tier (e.g. 50-page doc × 2 chunks = 25 pages/chunk = LONG each).
  const totalChars = rawText.length;
  const chunkPages = (chunkChars: number) =>
    pages ? Math.max(1, Math.round(pages * (chunkChars / totalChars))) : undefined;

  // Process all chunks in parallel. Each uses the normal fallback chain.
  // With Gemini Flash's 15 RPM free tier, 3 parallel requests is fine.
  const settled = await Promise.allSettled(
    chunks.map((ch, i) =>
      runWithFallback(annotateChunk(ch, i + 1, chunks.length), plan, preferredModel, chunkPages(ch.length)),
    ),
  );

  const successes: ProviderResult[] = [];
  const allAttempted: AttemptedEntry[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      successes.push(s.value);
      for (const a of s.value.attempted) allAttempted.push(a);
    } else {
      // record the chunk failure in attempted so process route can surface it
      const msg = (s.reason as { message?: string })?.message ?? String(s.reason);
      allAttempted.push({ id: 'gemini-2.0-flash' as ModelId, error: `chunk failed: ${msg}` });
    }
  }

  if (successes.length === 0) {
    const first = settled.find((s) => s.status === 'rejected') as PromiseRejectedResult | undefined;
    throw first?.reason ?? new Error('All chunks failed');
  }

  console.log(`[AI][chunked] ✓ ${successes.length}/${chunks.length} chunks succeeded`);
  const merged = mergeResults(successes, chunks.length);
  return { ...merged, attempted: allAttempted, chunks: chunks.length, sourceChars: rawText.length };
}

/**
 * Split text on paragraph boundaries into up to maxChunks pieces, each close
 * to maxCharsPerChunk. The final chunk absorbs any overflow so nothing is
 * dropped inside the MAX_CHUNKS × budget window.
 */
function splitIntoChunks(text: string, maxCharsPerChunk: number, maxChunks: number): string[] {
  const targetCount = Math.min(maxChunks, Math.ceil(text.length / maxCharsPerChunk));
  if (targetCount <= 1) return [text];

  const approxSize = Math.ceil(text.length / targetCount);
  const chunks: string[] = [];
  let pos = 0;

  for (let n = 0; n < targetCount - 1; n++) {
    let end = Math.min(pos + approxSize, text.length);
    // Prefer paragraph break inside the last 20% of the target chunk.
    const minEnd = pos + Math.floor(approxSize * 0.5);
    const paraBreak = text.lastIndexOf('\n\n', end);
    if (paraBreak > minEnd) {
      end = paraBreak + 2;
    } else {
      const lineBreak = text.lastIndexOf('\n', end);
      if (lineBreak > minEnd) end = lineBreak + 1;
    }
    chunks.push(text.slice(pos, end));
    pos = end;
  }
  // Final chunk = remainder. If the remainder is way bigger than budget
  // (user uploaded a monster PDF), truncate the TAIL of the remainder to
  // at most maxCharsPerChunk * 1.3 so we still fit the 60s route timeout.
  const remainder = text.slice(pos);
  const lastCap = Math.floor(maxCharsPerChunk * 1.3);
  chunks.push(remainder.length > lastCap ? remainder.slice(0, lastCap) : remainder);

  return chunks;
}

function annotateChunk(text: string, part: number, total: number): string {
  return `[CHUNK ${part} OF ${total}] You are analyzing part ${part} of a larger ${total}-part document. Generate comprehensive study materials covering the concepts visible in THIS section only — don't speculate about content in other parts.\n\n${text}`;
}

/**
 * Merge N successful ProviderResults into one StudyMaterial. Arrays are
 * concatenated and deduped where a natural key exists (definitions by
 * lowercased term, flashcards by front text).
 */
function mergeResults(results: ProviderResult[], chunkCount: number): Omit<ChunkedResult, 'chunks' | 'sourceChars'> {
  // Summary: join chunk summaries with a clear "Part N" heading.
  const mergedSummary = results
    .map((r, i) => {
      if (chunkCount <= 1) return r.material.summary;
      const header = `# Part ${i + 1} of ${chunkCount}\n\n`;
      return header + r.material.summary;
    })
    .join('\n\n---\n\n');

  const keyPoints = dedupStrings(results.flatMap((r) => r.material.keyPoints));
  const definitions = dedupByKey(
    results.flatMap((r) => r.material.definitions),
    (d) => d.term.toLowerCase().trim(),
  );
  const flashcards = dedupByKey(
    results.flatMap((r) => r.material.flashcards),
    (f) => f.front.toLowerCase().trim().slice(0, 80),
  );
  const examQuestions = dedupByKey(
    results.flatMap((r) => r.material.examQuestions),
    (q) => q.question.toLowerCase().trim().slice(0, 80),
  );
  const topicConnections = dedupStrings(results.flatMap((r) => r.material.topicConnections ?? []));
  const studyTips = dedupStrings(results.flatMap((r) => r.material.studyTips ?? []));

  const title = results[0].material.title;
  const tokensUsed = results.reduce((sum, r) => sum + r.tokensUsed, 0);
  const modelBase = results[0].model;
  const model = chunkCount > 1 ? `${modelBase} ×${chunkCount}` : modelBase;

  return {
    material: {
      title,
      summary: mergedSummary,
      keyPoints,
      definitions,
      flashcards,
      examQuestions,
      topicConnections: topicConnections.length > 0 ? topicConnections : undefined,
      studyTips: studyTips.length > 0 ? studyTips : undefined,
    },
    model,
    tokensUsed,
    attempted: [], // populated by caller from the chunk attempt logs
  };
}

function dedupByKey<T>(items: T[], keyFn: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = keyFn(item);
    if (k && !seen.has(k)) { seen.add(k); out.push(item); }
  }
  return out;
}

function dedupStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    const k = s.toLowerCase().trim().slice(0, 80);
    if (k && !seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out;
}
