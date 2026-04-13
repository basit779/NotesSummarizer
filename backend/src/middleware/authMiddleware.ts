import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { HttpError } from '../utils/httpError';

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    email: string;
    plan: 'FREE' | 'PRO';
    name: string;
  };
}

export async function authMiddleware(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Missing bearer token');
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, plan: true, name: true },
    });
    if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'User not found');
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    next(new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
}
