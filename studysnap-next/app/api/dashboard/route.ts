import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { getDailyUsage } from '@/lib/usage';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireAuth(req);
  const usage = await getDailyUsage(user.id, user.plan);
  const recent = await prisma.processingResult.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { file: { select: { filename: true, pageCount: true } } },
  });
  const totalUploads = await prisma.uploadedFile.count({ where: { userId: user.id } });
  const totalProcessed = await prisma.processingResult.count({ where: { userId: user.id } });
  return NextResponse.json({ usage, recent, totals: { uploads: totalUploads, processed: totalProcessed } });
});
