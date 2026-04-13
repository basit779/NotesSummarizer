import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { prisma } from './prisma';
import { HttpError } from './httpError';

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  plan: 'FREE' | 'PRO';
}

/**
 * Pulls Authorization: Bearer token, verifies, loads user. Throws HttpError(401) if invalid.
 * Call at the top of any protected route handler.
 */
export async function requireAuth(req: Request): Promise<AuthedUser> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing bearer token');
  }
  const token = header.slice(7);
  let payload: { sub: string };
  try {
    payload = jwt.verify(token, env.jwtSecret) as { sub: string };
  } catch {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, plan: true },
  });
  if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'User not found');
  return user as AuthedUser;
}

/** Convert thrown errors into consistent JSON responses. */
export function handleError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.flatten() } },
      { status: 400 },
    );
  }
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.statusCode },
    );
  }
  // eslint-disable-next-line no-console
  console.error('[API ERROR]', err);
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
    { status: 500 },
  );
}

/** Wrap a handler to convert thrown HttpErrors/ZodErrors into JSON responses. */
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse | Response>,
) {
  return async (...args: T) => {
    try { return await handler(...args); } catch (err) { return handleError(err); }
  };
}

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}
