import { NextResponse } from 'next/server';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireAuth(req);
  return NextResponse.json({ user });
});
