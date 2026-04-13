import type { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { HttpError } from '../utils/httpError';
import type { AuthedRequest } from '../middleware/authMiddleware';
import { getDailyUsage } from '../services/usageService';

export async function dashboard(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'UNAUTHORIZED', 'Not authenticated');
    const usage = await getDailyUsage(req.user.id, req.user.plan);

    const recent = await prisma.processingResult.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { file: { select: { filename: true, pageCount: true } } },
    });

    const totalUploads = await prisma.uploadedFile.count({ where: { userId: req.user.id } });
    const totalProcessed = await prisma.processingResult.count({ where: { userId: req.user.id } });

    res.json({ usage, recent, totals: { uploads: totalUploads, processed: totalProcessed } });
  } catch (err) {
    next(err);
  }
}
