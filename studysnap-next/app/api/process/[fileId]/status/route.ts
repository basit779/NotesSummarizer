import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';

export const runtime = 'nodejs';

/** Match the POST route's idempotency window. If status=PROCESSING and the lock
 *  is older than this, the worker function was almost certainly killed by Vercel's
 *  60s ceiling — surface as ERROR rather than letting the client poll forever. */
const STALE_PROCESSING_MS = 90_000;

/**
 * Poll endpoint for the async process pipeline.
 *
 *   - status='processing'      → still running, keep polling
 *   - status='done' + result   → render the pack, stop polling
 *   - status='error' + message → show the error, stop polling
 *
 * Stale-PROCESSING detection: if a file has been PROCESSING longer than the
 * idempotency window with no result row written, we treat the worker as
 * dead (Vercel killed the function at maxDuration) and report ERROR. The
 * client can then retry.
 */
export const GET = withErrorHandling(async (req: Request, ctx: { params: Promise<{ fileId: string }> }) => {
  const user = await requireAuth(req);
  const { fileId } = await ctx.params;

  const file = await prisma.uploadedFile.findUnique({
    where: { id: fileId },
    include: { result: true },
  });

  if (!file || file.userId !== user.id) {
    throw new HttpError(404, 'FILE_NOT_FOUND', 'File not found');
  }

  if (file.status === 'DONE' && file.result) {
    return NextResponse.json({ status: 'done', result: file.result });
  }

  if (file.status === 'ERROR') {
    return NextResponse.json({
      status: 'error',
      errorMessage: file.errorMessage ?? 'Generation failed',
    });
  }

  // PROCESSING: check for a dead worker.
  const startedAt = file.processingAt ? new Date(file.processingAt).getTime() : 0;
  const ageMs = startedAt ? Date.now() - startedAt : 0;
  if (startedAt && ageMs > STALE_PROCESSING_MS) {
    console.warn(`[PROCESS-STATUS] ${fileId} stale PROCESSING (${ageMs}ms) — surfacing as ERROR`);
    return NextResponse.json({
      status: 'error',
      errorMessage: 'Generation timed out. The document may be too large for our free-tier window — try a smaller PDF or retry.',
    });
  }

  return NextResponse.json({ status: 'processing' });
});
