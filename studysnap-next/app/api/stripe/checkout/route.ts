import { NextResponse } from 'next/server';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { createCheckoutSession } from '@/lib/billing';

export const runtime = 'nodejs';

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireAuth(req);
  const session = await createCheckoutSession(user.id, user.email, user.name);
  return NextResponse.json(session);
});
