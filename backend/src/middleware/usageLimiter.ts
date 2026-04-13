import type { NextFunction, Response } from 'express';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';
import type { AuthedRequest } from './authMiddleware';

function startOfUtcDay(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function usageLimiter(action: 'UPLOAD' | 'PROCESS') {
  return async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'UNAUTHORIZED', 'Not authenticated');
      if (req.user.plan === 'PRO') return next();

      const count = await prisma.usageLog.count({
        where: { userId: req.user.id, action, createdAt: { gte: startOfUtcDay() } },
      });
      if (count >= env.freeDailyUploadLimit) {
        throw new HttpError(
          429,
          'FREE_LIMIT_REACHED',
          `Daily ${action.toLowerCase()} limit reached on Free plan. Upgrade to Pro for unlimited access.`,
          { limit: env.freeDailyUploadLimit, used: count, upgrade: true },
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
