import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  const { id } = await ctx.params;
  const result = await prisma.processingResult.findUnique({
    where: { id },
    include: { file: { select: { filename: true, pageCount: true, sizeBytes: true } } },
  });
  if (!result || result.userId !== user.id) {
    throw new HttpError(404, 'RESULT_NOT_FOUND', 'Result not found');
  }
  return NextResponse.json({ result });
});
