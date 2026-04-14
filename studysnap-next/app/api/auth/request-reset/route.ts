import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { withErrorHandling } from '@/lib/apiHelpers';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().email() });

export const POST = withErrorHandling(async (req: Request) => {
  const body = await req.json();
  const { email } = schema.parse(body);
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return 200 — don't leak which emails exist.
  if (!user) {
    return NextResponse.json({ ok: true, message: 'If an account exists, a reset link has been issued.' });
  }
  const token = jwt.sign(
    { sub: user.id, type: 'reset' },
    env.jwtSecret,
    { expiresIn: '15m' } as jwt.SignOptions,
  );
  const resetUrl = `${env.appUrl}/reset-password?token=${token}`;
  // TODO: swap to Resend email delivery for production. For now, return on-screen.
  return NextResponse.json({ ok: true, token, resetUrl, message: 'Reset link generated.' });
});
