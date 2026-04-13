import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireAuth(req);
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ plan: user.plan, subscription: sub, billingMode: env.billingMode });
});
