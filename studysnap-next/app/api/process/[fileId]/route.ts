import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';
import { MODEL_REGISTRY } from '@/lib/ai/registry';
import type { ModelId } from '@/lib/ai/types';
import { inngest } from '@/lib/inngest';

export const runtime = 'nodejs';
// Route only does a quick DB read + enqueue, so it doesn't need the full 60s.
export const maxDuration = 10;

/** If a /process started within this many ms and hasn't finished, reject duplicate calls. */
const PROCESSING_LOCK_MS = 90_000;

/**
 * Async kick-off. Returns 202 in <1s with `{ jobId, status: 'processing' }`,
 * enqueues the heavy work as an Inngest event so it runs outside this route's
 * function lifetime. Per-user serialization is enforced by the Inngest
 * function's `concurrency: { key: 'event.data.userId', limit: 1 }`.
 *
 * Cache hits short-circuit synchronously and return `{ status: 'done', result }`
 * so the client can skip polling.
 */
export const POST = withErrorHandling(async (req: Request, ctx: { params: Promise<{ fileId: string }> }) => {
  const user = await requireAuth(req);
  const { fileId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const requestedModel: ModelId | undefined = body?.model && MODEL_REGISTRY[body.model as ModelId]
    ? (body.model as ModelId)
    : undefined;

  const file = await prisma.uploadedFile.findUnique({ where: { id: fileId }, include: { result: true } });
  if (!file || file.userId !== user.id) {
    throw new HttpError(404, 'FILE_NOT_FOUND', 'File not found');
  }
  if (file.result) {
    console.log(`[PROCESS] ${fileId} cache hit — 0 API calls`);
    return NextResponse.json({ jobId: fileId, status: 'done', result: file.result, cached: true });
  }

  if (file.processingAt) {
    const ageMs = Date.now() - new Date(file.processingAt).getTime();
    if (ageMs < PROCESSING_LOCK_MS) {
      console.log(`[PROCESS] ${fileId} already processing (${ageMs}ms ago) — rejecting duplicate`);
      throw new HttpError(409, 'ALREADY_PROCESSING', 'This file is already being processed. Wait a moment and refresh.');
    }
    console.log(`[PROCESS] ${fileId} stale lock (${ageMs}ms) — allowing retry`);
  }

  await prisma.uploadedFile.update({
    where: { id: fileId },
    data: { processingAt: new Date(), status: 'PROCESSING', errorMessage: null },
  });

  await inngest.send({
    name: 'process.file',
    data: { fileId, userId: user.id, plan: user.plan, requestedModel },
  });

  return NextResponse.json({ jobId: fileId, status: 'processing' }, { status: 202 });
});
