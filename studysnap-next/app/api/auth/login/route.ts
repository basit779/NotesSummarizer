import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validators';
import { signToken, withErrorHandling, readJsonBody } from '@/lib/apiHelpers';
import { enforceAuthRateLimit, getClientIp } from '@/lib/rateLimit';
import { HttpError } from '@/lib/httpError';

export const runtime = 'nodejs';

// A valid-format bcrypt hash of a random string. Compared against when the
// email doesn't exist so the response takes the same ~time as a real
// wrong-password check — defeats timing-based account enumeration.
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMy.MH/rL2tWFEjBkE/8a3pX9YJ8jKjQ8YS';

export const POST = withErrorHandling(async (req: Request) => {
  // Throttle brute-force / credential-stuffing: 8 attempts per IP / 15 min.
  await enforceAuthRateLimit({
    key: `login:ip:${getClientIp(req)}`,
    maxAttempts: 8,
    windowSeconds: 900,
    message: 'Too many login attempts. Please wait a few minutes and try again.',
  });

  const body = await readJsonBody(req);
  const { email, password } = loginSchema.parse(body);
  const user = await prisma.user.findUnique({ where: { email } });
  // Always run bcrypt.compare (against a dummy hash when the user is missing)
  // so existing vs non-existing emails take the same time — no enumeration.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  const token = signToken(user.id);
  return NextResponse.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
  });
});
