import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireAuth(req);
  const url = new URL(req.url);
  // Coerce defensively — a non-numeric ?page=abc would otherwise become NaN and
  // crash Prisma's skip/take with a 500. Fall back to defaults, clamp to sane bounds.
  const pageRaw = Number(url.searchParams.get('page'));
  const pageSizeRaw = Number(url.searchParams.get('pageSize'));
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(50, Math.max(1, Math.floor(pageSizeRaw))) : 20;

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
