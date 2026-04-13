import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validators';
import { signToken, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';

export const runtime = 'nodejs';

export const POST = withErrorHandling(async (req: Request) => {
  const body = await req.json();
  const { email, password } = loginSchema.parse(body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  const token = signToken(user.id);
  return NextResponse.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
  });
});
