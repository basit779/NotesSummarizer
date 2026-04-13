import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireAuth(req);
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const pageSize = Math.min(50, Number(url.searchParams.get('pageSize') ?? 20));

  const [items, total] = await Promise.all([
    prisma.processingResult.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { file: { select: { filename: true, pageCount: true, sizeBytes: true } } },
    }),
    prisma.processingResult.count({ where: { userId: user.id } }),
  ]);
  return NextResponse.json({ items, total, page, pageSize });
});
