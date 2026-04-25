import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { waitUntil } from '@vercel/functions';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';
import { extractTextFromPdfBuffer } from '@/lib/pdf';
import { analyzeText } from '@/lib/ai';
import { MODEL_REGISTRY } from '@/lib/ai/registry';
import type { ModelId } from '@/lib/ai/types';
import { logUsage } from '@/lib/usage';
import { runSerial } from '@/lib/ai/queue';
import { storePdfCache } from '@/lib/ai/pdfCache';
import { buildRagIndex } from '@/lib/ai/ragIndex';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** If a /process started within this many ms and hasn't finished, reject duplicate calls. */
const PROCESSING_LOCK_MS = 90_000; // 90s — max expected processing time

/**
 * Async kick-off. Returns 202 in <1s with `{ jobId, status: 'processing' }`,
 * runs the pipeline detached via waitUntil so the browser doesn't sit on
 * the connection for the full 60s function lifetime.
 *
 * Cache hits (file.result already exists) short-circuit synchronously and
 * return `{ status: 'done', result }` so the client can skip polling.
 *
 * NB: On Vercel Hobby, waitUntil is still bound by maxDuration (60s) — the
 * function instance is killed at the cap regardless of whether work is
 * detached. The status GET endpoint applies a stale-PROCESSING check so
 * stuck rows surface as ERROR rather than polling forever.
 */
export const POST = withErrorHandling(async (req: Request, ctx: { params: Promise<{ fileId: string }> }) => {
  const user = await requireAuth(req);
  const { fileId } = await ctx.params;

  // Drain body before responding — request stream may be torn down once
  // the response flushes, so reading req.json() inside waitUntil is unsafe.
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

  // Idempotency lock — prevent duplicate processing if user double-clicks or a retry comes in
  if (file.processingAt) {
    const ageMs = Date.now() - new Date(file.processingAt).getTime();
    if (ageMs < PROCESSING_LOCK_MS) {
      console.log(`[PROCESS] ${fileId} already processing (${ageMs}ms ago) — rejecting duplicate`);
      throw new HttpError(409, 'ALREADY_PROCESSING', 'This file is already being processed. Wait a moment and refresh.');
    }
    // lock expired (stuck process) — allow retry
    console.log(`[PROCESS] ${fileId} stale lock (${ageMs}ms) — allowing retry`);
  }

  // Acquire lock + flip status to PROCESSING (resets errorMessage from any prior failed run).
  await prisma.uploadedFile.update({
    where: { id: fileId },
    data: { processingAt: new Date(), status: 'PROCESSING', errorMessage: null },
  });

  // Detach the heavy work. Serialized per-user via runSerial so concurrent
  // tabs from the same user don't double-burn quota inside this region.
  waitUntil(runSerial(user.id, () => runPipeline(user, fileId, requestedModel)));

  return NextResponse.json({ jobId: fileId, status: 'processing' }, { status: 202 });
});

async function runPipeline(
  user: { id: string; plan: 'FREE' | 'PRO' },
  fileId: string,
  requestedModel: ModelId | undefined,
) {
  try {
    const file = await prisma.uploadedFile.findUnique({ where: { id: fileId } });
    if (!file) {
      console.warn(`[PROCESS] ${fileId} disappeared before background work started`);
      return;
    }

    let text: string;
    let pages: number;

    if (file.storagePath.startsWith('mem:base64:')) {
      const buffer = Buffer.from(file.storagePath.slice('mem:base64:'.length), 'base64');
      const extracted = await extractTextFromPdfBuffer(buffer);
      text = extracted.text;
      pages = extracted.pages;
    } else if (file.storagePath.startsWith('mem:text:')) {
      text = Buffer.from(file.storagePath.slice('mem:text:'.length), 'base64').toString('utf8');
      pages = file.pageCount ?? 0;
    } else {
      throw new Error('File storage format not recognized');
    }

    console.log(`[PROCESS] ${fileId} — ${pages} pages, ${text.length} chars, model=${requestedModel ?? 'auto'}`);

    const { material, model, tokensUsed, attempted, chunks, sourceChars, degraded, fallbackUsed } =
      await analyzeText(text, user.plan, requestedModel, pages);

    await prisma.processingResult.create({
      data: {
        fileId: file.id,
        userId: user.id,
        summary: material.summary,
        keyPoints: material.keyPoints as any,
        definitions: material.definitions as any,
        examQuestions: material.examQuestions as any,
        flashcards: material.flashcards as any,
        model,
        tokensUsed,
        fallbackUsed: fallbackUsed ?? null,
      },
    });
    // Free DB space — the base64 PDF blob is no longer needed once ProcessingResult
    // exists. Replace with a tiny sentinel so the schema's NOT NULL constraint is happy.
    await prisma.uploadedFile.update({
      where: { id: file.id },
      data: {
        pageCount: pages,
        storagePath: 'consumed',
        processingAt: null,
        status: 'DONE',
        errorMessage: null,
      },
    });
    await logUsage(user.id, 'UPLOAD');
    await logUsage(user.id, 'PROCESS');

    if (file.contentHash) {
      const cacheReqId = crypto.randomBytes(6).toString('hex');
      await storePdfCache({
        contentHash: file.contentHash,
        pack: {
          summary: material.summary,
          keyPoints: material.keyPoints,
          definitions: material.definitions,
          examQuestions: material.examQuestions,
          flashcards: material.flashcards,
          originalModel: model,
        },
        pageCount: pages,
        reqId: cacheReqId,
      });

      // Build the RAG index synchronously so it's ready before the user's first chat
      // message. Awaited inside waitUntil — failures swallowed inside buildRagIndex
      // so a RAG outage never blocks the pack.
      await buildRagIndex({ contentHash: file.contentHash, text, reqId: cacheReqId });
    }

    console.log(`[PROCESS] ${fileId} ✓ done — model=${model}, tokens=${tokensUsed}, attempts=${attempted.length}, chunks=${chunks}, sourceChars=${sourceChars}${degraded ? ', DEGRADED (pass-2 failed)' : ''}${fallbackUsed ? `, FALLBACK=${fallbackUsed}` : ''}`);
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : 'Generation failed';
    console.error(`[PROCESS] ${fileId} ✗ failed — ${message}`);
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { processingAt: null, status: 'ERROR', errorMessage: message.slice(0, 500) },
    }).catch(() => {});
  }
}
