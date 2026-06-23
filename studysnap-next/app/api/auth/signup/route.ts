import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signupSchema } from '@/lib/validators';
import { signToken, withErrorHandling, readJsonBody } from '@/lib/apiHelpers';
import { enforceAuthRateLimit, getClientIp } from '@/lib/rateLimit';
import { HttpError } from '@/lib/httpError';

export const runtime = 'nodejs';

export const POST = withErrorHandling(async (req: Request) => {
  // Throttle automated account creation: 5 signups per IP / hour.
  await enforceAuthRateLimit({
    key: `signup:ip:${getClientIp(req)}`,
    maxAttempts: 5,
    windowSeconds: 3600,
    message: 'Too many sign-up attempts. Please wait and try again.',
  });

  const body = await readJsonBody(req);
  const { name, email, password } = signupSchema.parse(body);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, 'EMAIL_TAKEN', 'An account with that email already exists.');
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true, email: true, name: true, plan: true },
  });
  const token = signToken(user.id);
  return NextResponse.json({ token, user }, { status: 201 });
});
