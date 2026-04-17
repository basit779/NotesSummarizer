/**
 * Cross-user PDF cache. Looks up by sha256 of uploaded bytes. On hit, we reuse
 * the stored AI pack instead of re-running providers (0 tokens, 0 API calls).
 *
 * Design notes:
 *  - Lookup uses a single atomic `update` with `hitCount: { increment: 1 }`.
 *    Prisma throws P2025 if the row doesn't exist — that's our miss signal.
 *  - Expired rows are treated as miss in code (we still incremented hitCount
 *    on them, but they'll be removed by the next self-clean). Harmless.
 *  - Store path upserts and then deletes up to 10 expired rows (raw SQL —
 *    Prisma's deleteMany has no LIMIT and unbounded deletes on a hot path is
 *    a footgun).
 *  - Self-contained: no imports from the 9-phase telemetry/cache/queue modules.
 */

import { prisma } from '@/lib/prisma';
import { logPdfCacheEvent } from './cacheTelemetry';
import type { StudyMaterial } from './types';

const TTL_DAYS = 90;
const SELF_CLEAN_LIMIT = 10;

/** Shape stored in pdf_cache.generatedPack. Mirrors ProcessingResult columns
 *  minus tokensUsed (always 0 on cache-serve). originalModel is the provider
 *  that generated it — ProcessingResult.model gets "pdf_cache" as a sentinel. */
export interface PdfCachePack {
  summary: string;
  keyPoints: StudyMaterial['keyPoints'];
  definitions: StudyMaterial['definitions'];
  examQuestions: StudyMaterial['examQuestions'];
  flashcards: StudyMaterial['flashcards'];
  originalModel: string;
}

export interface PdfCacheHit {
  pack: PdfCachePack;
  pageCount: number | null;
  hitCount: number;
}

function short(hash: string) {
  return hash.slice(0, 12);
}

function isValidPack(x: unknown): x is PdfCachePack {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.summary === 'string' &&
    Array.isArray(p.keyPoints) &&
    Array.isArray(p.definitions) &&
    Array.isArray(p.examQuestions) &&
    Array.isArray(p.flashcards) &&
    typeof p.originalModel === 'string'
  );
}

/**
 * Atomic cache lookup. Returns the pack on valid, unexpired hit; null on miss.
 * Never throws — telemetry is emitted on every code path.
 */
export async function lookupPdfCache(contentHash: string, reqId: string): Promise<PdfCacheHit | null> {
  const start = Date.now();
  try {
    const row = await prisma.pdfCache.update({
      where: { contentHash },
      data: { hitCount: { increment: 1 } },
      select: { generatedPack: true, pageCount: true, expiresAt: true, hitCount: true },
    });
    if (row.expiresAt.getTime() < Date.now()) {
      logPdfCacheEvent({
        reqId,
        outcome: 'miss',
        contentHashShort: short(contentHash),
        errorCode: 'EXPIRED',
        elapsedMs: Date.now() - start,
      });
      return null;
    }
    const pack = row.generatedPack;
    if (!isValidPack(pack)) {
      logPdfCacheEvent({
        reqId,
        outcome: 'miss',
        contentHashShort: short(contentHash),
        errorCode: 'BAD_PACK_SHAPE',
        elapsedMs: Date.now() - start,
      });
      return null;
    }
    logPdfCacheEvent({
      reqId,
      outcome: 'hit',
      contentHashShort: short(contentHash),
      hitCount: row.hitCount,
      pageCount: row.pageCount ?? undefined,
      elapsedMs: Date.now() - start,
    });
    return { pack, pageCount: row.pageCount ?? null, hitCount: row.hitCount };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2025') {
      logPdfCacheEvent({
        reqId,
        outcome: 'miss',
        contentHashShort: short(contentHash),
        elapsedMs: Date.now() - start,
      });
      return null;
    }
    logPdfCacheEvent({
      reqId,
      outcome: 'miss',
      contentHashShort: short(contentHash),
      errorCode: code ?? 'UNKNOWN',
      elapsedMs: Date.now() - start,
    });
    return null;
  }
}

/**
 * Store (or refresh) a pack for a given contentHash. Upsert semantics — on an
 * existing live row we overwrite the pack but preserve hitCount. Self-cleans
 * up to 10 expired rows as a side effect (bounded, so safe on a hot path).
 * Never throws; failures are logged and swallowed (cache write is best-effort).
 */
export async function storePdfCache(params: {
  contentHash: string;
  pack: PdfCachePack;
  pageCount: number | null;
  reqId: string;
}): Promise<void> {
  const { contentHash, pack, pageCount, reqId } = params;
  const start = Date.now();
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
  try {
    await prisma.pdfCache.upsert({
      where: { contentHash },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { contentHash, generatedPack: pack as any, pageCount, expiresAt },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: { generatedPack: pack as any, pageCount, expiresAt },
    });
    const cleanedExpired = await selfCleanExpired();
    logPdfCacheEvent({
      reqId,
      outcome: 'store',
      contentHashShort: short(contentHash),
      pageCount: pageCount ?? undefined,
      cleanedExpired,
      elapsedMs: Date.now() - start,
    });
  } catch (err) {
    logPdfCacheEvent({
      reqId,
      outcome: 'store_failed',
      contentHashShort: short(contentHash),
      errorCode: (err as { code?: string })?.code ?? 'UNKNOWN',
      elapsedMs: Date.now() - start,
    });
  }
}

async function selfCleanExpired(): Promise<number> {
  try {
    const deleted = await prisma.$executeRawUnsafe(
      `DELETE FROM pdf_cache WHERE id IN (
         SELECT id FROM pdf_cache WHERE "expiresAt" < NOW() LIMIT ${SELF_CLEAN_LIMIT}
       )`
    );
    return Number(deleted) || 0;
  } catch {
    return 0;
  }
}
