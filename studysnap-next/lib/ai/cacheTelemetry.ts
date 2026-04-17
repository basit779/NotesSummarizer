/**
 * PDF-cache telemetry. Separate file from telemetry.ts (Phase 9) so the
 * 9-phase stability stack stays untouched. Emits the same [TELEM] JSON-line
 * format — Vercel log search and existing grep tooling pick these up the same
 * way as provider/request events.
 */

export type PdfCacheOutcome = 'hit' | 'miss' | 'store' | 'store_failed';

export interface PdfCacheEvent {
  reqId: string;
  outcome: PdfCacheOutcome;
  contentHashShort: string;
  hitCount?: number;
  pageCount?: number;
  cleanedExpired?: number;
  errorCode?: string;
  elapsedMs?: number;
}

export function logPdfCacheEvent(event: PdfCacheEvent) {
  try {
    const { reqId, outcome, contentHashShort, hitCount, pageCount, cleanedExpired, errorCode, elapsedMs } = event;
    // eslint-disable-next-line no-console
    console.log(`[TELEM] ${JSON.stringify({
      ts: new Date().toISOString(),
      kind: 'pdf_cache',
      reqId,
      outcome,
      contentHashShort,
      hitCount,
      pageCount,
      cleanedExpired,
      errorCode,
      elapsedMs,
    })}`);
  } catch {
    // never throw from telemetry
  }
}
