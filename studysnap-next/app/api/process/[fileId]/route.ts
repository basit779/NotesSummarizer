import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';
import { extractTextFromPdfBuffer } from '@/lib/pdf';
import { analyzeText } from '@/lib/ai';
import { MODEL_REGISTRY } from '@/lib/ai/registry';
import { willTruncate } from '@/lib/ai/truncate';
import type { ModelId } from '@/lib/ai/types';
import { logUsage } from '@/lib/usage';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** If a /process started within this many ms and hasn't finished, reject duplicate calls. */
const PROCESSING_LOCK_MS = 90_000; // 90s — max expected processing time

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
    return NextResponse.json({ result: file.result, cached: true });
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

  // Acquire lock
  await prisma.uploadedFile.update({
    where: { id: fileId },
    data: { processingAt: new Date() },
  });

  try {
    if (!file.storagePath.startsWith('mem:base64:')) {
      throw new HttpError(500, 'BAD_STORAGE', 'File storage format not recognized');
    }
    const buffer = Buffer.from(file.storagePath.slice('mem:base64:'.length), 'base64');
    const { text, pages } = await extractTextFromPdfBuffer(buffer);

    console.log(`[PROCESS] ${fileId} — ${pages} pages, ${text.length} chars, model=${requestedModel ?? 'auto'}`);

    const truncated = willTruncate(text);
    const { material, model, tokensUsed, attempted } = await analyzeText(text, user.plan, requestedModel);

    const result = await prisma.processingResult.create({
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
      },
    });
    await prisma.uploadedFile.update({
      where: { id: file.id },
      data: { pageCount: pages, storagePath: 'consumed', processingAt: null },
    });
    await logUsage(user.id, 'UPLOAD');
    await logUsage(user.id, 'PROCESS');

    console.log(`[PROCESS] ${fileId} ✓ done — model=${model}, tokens=${tokensUsed}, attempts=${attempted.length}`);
    return NextResponse.json({ result, cached: false, attempted, truncated }, { status: 201 });
  } catch (err) {
    // Release lock on failure so user can retry
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { processingAt: null },
    }).catch(() => {});
    throw err;
  }
});
