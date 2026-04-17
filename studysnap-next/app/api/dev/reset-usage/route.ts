import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export const POST = withErrorHandling(async (req: Request) => {
  // Guard: this endpoint is a developer convenience — never expose it in production.
  if (env.isProd) {
    throw new HttpError(404, 'NOT_FOUND', 'Not found');
  }
  const user = await requireAuth(req);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const result = await prisma.usageLog.deleteMany({
    where: { userId: user.id, createdAt: { gte: today } },
  });
  return NextResponse.json({ deleted: result.count, message: 'Usage reset for today' });
});
