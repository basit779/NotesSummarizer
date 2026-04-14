import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';

export const runtime = 'nodejs';

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireAuth(req);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const result = await prisma.usageLog.deleteMany({
    where: { userId: user.id, createdAt: { gte: today } },
  });
  return NextResponse.json({ deleted: result.count, message: 'Usage reset for today' });
});
