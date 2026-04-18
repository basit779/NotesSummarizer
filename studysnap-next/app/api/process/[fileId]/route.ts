import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';
import { extractTextFromPdfBuffer } from '@/lib/pdf';
import { analyzeText } from '@/lib/ai';
import { MODEL_REGISTRY } from '@/lib/ai/registry';
import { willTruncate } from '@/lib/ai/truncate';
import type { ModelId } from '@/lib/ai/types';
import { logUsage } from '@/lib/usage';
import { runSerial } from '@/lib/ai/queue';
import { storePdfCache } from '@/lib/ai/pdfCache';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** If a /process started within this many ms and hasn't finished, reject duplicate calls. */
const PROCESSING_LOCK_MS = 90_000; // 90s — max expected processing time

export const POST = withErrorHandling(async (req: Request, ctx: { params: Promise<{ fileId: string }> }) => {
  const user = await requireAuth(req);
  const { fileId } = await ctx.params;
  // Serialize per-user so concurrent tabs don't double-burn quota.
  return runSerial(user.id, () => processOne(user, fileId, req));
});

async function processOne(user: { id: string; plan: 'FREE' | 'PRO' }, fileId: string, req: Request) {
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
    let text: string;
    let pages: number;

    if (file.storagePath.startsWith('mem:base64:')) {
      // Single-PDF path — extract text from raw bytes now.
      const buffer = Buffer.from(file.storagePath.slice('mem:base64:'.length), 'base64');
      const extracted = await extractTextFromPdfBuffer(buffer);
      text = extracted.text;
      pages = extracted.pages;
    } else if (file.storagePath.startsWith('mem:text:')) {
      // Multi-file path — text was already extracted at upload time.
      text = Buffer.from(file.storagePath.slice('mem:text:'.length), 'base64').toString('utf8');
      pages = file.pageCount ?? 0;
    } else {
      throw new HttpError(500, 'BAD_STORAGE', 'File storage format not recognized');
    }

    console.log(`[PROCESS] ${fileId} — ${pages} pages, ${text.length} chars, model=${requestedModel ?? 'auto'}`);

    const truncated = willTruncate(text);
    const { material, model, tokensUsed, attempted, chunks, sourceChars, degraded } = await analyzeText(text, user.plan, requestedModel, pages);

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
    // Free DB space — the base64 PDF blob is no longer needed once ProcessingResult
    // exists. Replace with a tiny sentinel so schema's NOT NULL constraint is happy.
    await prisma.uploadedFile.update({
      where: { id: file.id },
      data: { pageCount: pages, storagePath: 'consumed', processingAt: null },
    });
    await logUsage(user.id, 'UPLOAD');
    await logUsage(user.id, 'PROCESS');

    // Store in cross-user PDF cache so future uploaders hit instantly (0 tokens).
    // Awaited intentionally: Vercel may kill fire-and-forget promises after the
    // response flushes. The write is fast (<100ms) and never throws.
    if (file.contentHash) {
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
        reqId: crypto.randomBytes(6).toString('hex'),
      });
    }

    console.log(`[PROCESS] ${fileId} ✓ done — model=${model}, tokens=${tokensUsed}, attempts=${attempted.length}, chunks=${chunks}, sourceChars=${sourceChars}${degraded ? ', DEGRADED (pass-2 failed)' : ''}`);
    return NextResponse.json({ result, cached: false, attempted, truncated, chunks, sourceChars, degraded: Boolean(degraded) }, { status: 201 });
  } catch (err) {
    // Release lock on failure so user can retry
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { processingAt: null },
    }).catch(() => {});
    throw err;
  }
}
