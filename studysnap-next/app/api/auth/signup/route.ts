import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signupSchema } from '@/lib/validators';
import { signToken, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';

export const runtime = 'nodejs';

export const POST = withErrorHandling(async (req: Request) => {
  const body = await req.json();
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
