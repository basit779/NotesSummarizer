import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { env, assertJwtSecretReady } from '@/lib/env';
import { signToken, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';

export const runtime = 'nodejs';

const schema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(128),
});

export const POST = withErrorHandling(async (req: Request) => {
  assertJwtSecretReady();
  const body = await req.json();
  const { token, newPassword } = schema.parse(body);

  let payload: { sub: string; type?: string };
  try {
    payload = jwt.verify(token, env.jwtSecret) as { sub: string; type?: string };
  } catch {
    throw new HttpError(400, 'BAD_TOKEN', 'Reset link is invalid or expired.');
  }
  if (payload.type !== 'reset') {
    throw new HttpError(400, 'BAD_TOKEN', 'Reset link is invalid or expired.');
  }

  const hash = await bcrypt.hash(newPassword, 10);
  let user;
  try {
    user = await prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash: hash },
      select: { id: true, email: true, name: true, plan: true },
    });
  } catch (err) {
    // P2025 = "record to update not found" — a valid-looking token whose user
    // was deleted. Surface a clean 400 instead of an unhandled Prisma 500.
    if ((err as { code?: string })?.code === 'P2025') {
      throw new HttpError(400, 'BAD_TOKEN', 'Reset link is invalid or expired.');
    }
    throw err;
  }
  const authToken = signToken(user.id);
  return NextResponse.json({ token: authToken, user });
});
