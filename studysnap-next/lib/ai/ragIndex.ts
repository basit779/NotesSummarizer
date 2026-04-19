/**
 * RAG index builder — chunks extracted PDF text and embeds each chunk,
 * writing rows to pdf_chunk + embedding_cache. Called from /process after
 * pack generation succeeds. Cross-user: keyed by contentHash, so cache-hit
 * users inherit chunks without re-running this.
 *
 * Failure is non-fatal to the caller — if indexing fails OR times out, the
 * pack still saves and chat silently falls back to legacy context (the
 * chunk-existence check returns zero). Same safety contract as the 2-pass
 * XL pass-2 watchdog: bounded wall time, degraded output beats a 60s
 * function timeout killing the whole request.
 */

import { prisma } from '@/lib/prisma';
import { embedBatch } from './embeddings';

const TARGET_CHARS = 2000;     // ~500 tokens at chars/4 estimate
const OVERLAP_CHARS = 200;     // ~50 tokens overlap
const MIN_CHUNK_CHARS = 60;    // drop trailing scrap that can't carry context
const INDEX_TIMEOUT_MS = 20_000; // hard ceiling — embed hangs fall through to legacy

export interface BuildRagIndexResult {
  built: boolean;
  chunkCount: number;
  cacheHits: number;
  newEmbeds: number;
  elapsedMs: number;
}

/** Word-boundary chunker. Produces ~500-token chunks with ~50-token overlap. */
export function chunkText(text: string): string[] {
  const out: string[] = [];
  const clean = text.trim();
  if (clean.length === 0) return out;

  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + TARGET_CHARS, clean.length);
    // If we're not at EOF, snap back to the last whitespace within the final
    // 15% of the target window so we don't split mid-word.
    if (end < clean.length) {
      const minSnap = end - Math.floor(TARGET_CHARS * 0.15);
      const ws = clean.lastIndexOf(' ', end);
      if (ws >= minSnap) end = ws;
    }
    const piece = clean.slice(start, end).trim();
    if (piece.length >= MIN_CHUNK_CHARS) out.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - OVERLAP_CHARS, start + 1); // always make forward progress
  }
  return out;
}

/**
 * Build (or rebuild) the RAG index for a given contentHash. Idempotent —
 * safe to call concurrently on the same hash; @@unique([contentHash, chunkIndex])
 * prevents duplicate rows, upserts on embedding_cache keep vectors current.
 *
 * Never throws, never waits longer than INDEX_TIMEOUT_MS. On timeout we
 * resolve with { built: false }; the in-flight embed/DB writes continue
 * running in the background and may still populate the index for future
 * chat turns — we just don't block /process waiting on them.
 */
export async function buildRagIndex(params: {
  contentHash: string;
  text: string;
  reqId: string;
}): Promise<BuildRagIndexResult> {
  const { contentHash, reqId } = params;
  const t0 = Date.now();
  const notBuilt = (): BuildRagIndexResult => ({
    built: false, chunkCount: 0, cacheHits: 0, newEmbeds: 0, elapsedMs: Date.now() - t0,
  });

  return new Promise<BuildRagIndexResult>((resolve) => {
    const timer = setTimeout(() => {
      console.log(`[AI][rag] reqId=${reqId} hash=${contentHash.slice(0, 12)} INDEX TIMEOUT after ${INDEX_TIMEOUT_MS}ms — chat will use legacy fallback`);
      resolve(notBuilt());
    }, INDEX_TIMEOUT_MS);

    runBuild(params, t0).then(
      (r) => { clearTimeout(timer); resolve(r); },
      (err) => {
        clearTimeout(timer);
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[AI][rag] reqId=${reqId} hash=${contentHash.slice(0, 12)} INDEX FAILED — chat will use legacy fallback: ${msg}`);
        resolve(notBuilt());
      },
    );
  });
}

/** Happy-path body. Throws on any error; the caller wraps this in the
 *  timeout + catch envelope above so buildRagIndex's contract stays
 *  "never throws". */
async function runBuild(
  params: { contentHash: string; text: string; reqId: string },
  t0: number,
): Promise<BuildRagIndexResult> {
  const { contentHash, text, reqId } = params;

  // Already indexed? Skip. Cheap point-get on composite unique index.
  const existing = await prisma.pdfChunk.findFirst({
    where: { contentHash },
    select: { id: true },
  });
  if (existing) {
    console.log(`[AI][rag] hash=${contentHash.slice(0, 12)} already indexed — skipping`);
    return { built: false, chunkCount: 0, cacheHits: 0, newEmbeds: 0, elapsedMs: Date.now() - t0 };
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    console.log(`[AI][rag] hash=${contentHash.slice(0, 12)} empty text — skipping`);
    return { built: false, chunkCount: 0, cacheHits: 0, newEmbeds: 0, elapsedMs: Date.now() - t0 };
  }

  const embedT0 = Date.now();
  const { cacheHits, newEmbeds } = await embedBatch(chunks);
  const embedMs = Date.now() - embedT0;
  console.log(`[AI][embed] cache_hit_count=${cacheHits} new_embed_count=${newEmbeds} chunk_count=${chunks.length} elapsed_ms=${embedMs}`);

  // Bulk insert chunks. createMany is safe under the composite unique
  // constraint; on race with another /process for same hash, we'd hit
  // P2002 — fall through to the findFirst guard on retry.
  await prisma.pdfChunk.createMany({
    data: chunks.map((t, i) => ({
      contentHash,
      chunkIndex: i,
      text: t,
      tokenCount: Math.ceil(t.length / 4),
    })),
    skipDuplicates: true,
  });

  const elapsedMs = Date.now() - t0;
  console.log(`[AI][rag] reqId=${reqId} hash=${contentHash.slice(0, 12)} indexed — chunks=${chunks.length} cache_hits=${cacheHits} new_embeds=${newEmbeds} elapsed_ms=${elapsedMs}`);
  return { built: true, chunkCount: chunks.length, cacheHits, newEmbeds, elapsedMs };
}
