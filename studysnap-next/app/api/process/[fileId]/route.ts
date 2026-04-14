import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';
import { extractTextFromPdfBuffer } from '@/lib/pdf';
import { analyzeText } from '@/lib/ai';
import { MODEL_REGISTRY } from '@/lib/ai/registry';
import type { ModelId } from '@/lib/ai/types';
import { logUsage } from '@/lib/usage';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    return NextResponse.json({ result: file.result, cached: true });
  }

  if (!file.storagePath.startsWith('mem:base64:')) {
    throw new HttpError(500, 'BAD_STORAGE', 'File storage format not recognized');
  }
  const buffer = Buffer.from(file.storagePath.slice('mem:base64:'.length), 'base64');

  const { text, pages } = await extractTextFromPdfBuffer(buffer);
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
    // free up storage now that we've processed it — keep metadata only
    data: { pageCount: pages, storagePath: 'consumed' },
  });
  // Count a successful generation as the billable action (was: upload counted).
  await logUsage(user.id, 'UPLOAD');
  await logUsage(user.id, 'PROCESS');

  return NextResponse.json({ result, cached: false, attempted }, { status: 201 });
});
