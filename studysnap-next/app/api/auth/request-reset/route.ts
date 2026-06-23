import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { env, assertJwtSecretReady } from '@/lib/env';
import { withErrorHandling, readJsonBody } from '@/lib/apiHelpers';
import { enforceAuthRateLimit, getClientIp } from '@/lib/rateLimit';
import { sendPasswordResetEmail } from '@/lib/mailer';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().email() });

export const POST = withErrorHandling(async (req: Request) => {
  assertJwtSecretReady();
  // Throttle by IP (mass abuse) and by email (don't let anyone email-bomb a
  // victim with reset links). Both windows are generous enough for real users.
  await enforceAuthRateLimit({ key: `reset:ip:${getClientIp(req)}`, maxAttempts: 10, windowSeconds: 3600 });
  const body = await readJsonBody(req);
  const { email } = schema.parse(body);
  await enforceAuthRateLimit({ key: `reset:email:${email.toLowerCase()}`, maxAttempts: 5, windowSeconds: 3600 });
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return 200 — don't leak which emails exist.
  if (!user) {
    return NextResponse.json({ ok: true, emailSent: false, message: 'If an account exists, a reset link has been issued.' });
  }
  const token = jwt.sign(
    { sub: user.id, type: 'reset' },
    env.jwtSecret,
    { expiresIn: '15m' } as jwt.SignOptions,
  );
  const resetUrl = `${env.appUrl}/reset-password?token=${token}`;

  const { delivered, error } = await sendPasswordResetEmail({ to: email, resetUrl, expiresInMinutes: 15 });

  if (delivered) {
    return NextResponse.json({ ok: true, emailSent: true, message: 'Reset email sent. Check your inbox.' });
  }

  // Email failed to send (or Resend not configured). In dev, return the URL inline so the
  // user can still complete the flow. In prod, don't leak it — force user to try again.
  if (env.isProd && error === 'RESEND_NOT_CONFIGURED') {
    console.error('[auth/request-reset] RESEND_API_KEY not set in production — reset email was NOT delivered for', email);
    return NextResponse.json(
      { ok: true, emailSent: false, message: 'Email delivery is not configured. Contact support.' },
      { status: 200 },
    );
  }

  return NextResponse.json({
    ok: true,
    emailSent: false,
    devMode: !env.isProd,
    resetUrl: env.isProd ? undefined : resetUrl,
    message: env.isProd ? 'We could not send the email right now. Please try again.' : 'Dev mode: email not sent, use the link below.',
  });
});
