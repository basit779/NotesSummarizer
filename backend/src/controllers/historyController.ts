import type { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { HttpError } from '../utils/httpError';
import type { AuthedRequest } from '../middleware/authMiddleware';

export async function listHistory(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'UNAUTHORIZED', 'Not authenticated');
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(50, Number(req.query.pageSize ?? 20));

    const [items, total] = await Promise.all([
      prisma.processingResult.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { file: { select: { filename: true, pageCount: true, sizeBytes: true } } },
      }),
      prisma.processingResult.count({ where: { userId: req.user.id } }),
    ]);

    res.json({ items, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

export async function getResult(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'UNAUTHORIZED', 'Not authenticated');
    const { id } = req.params;
    const result = await prisma.processingResult.findUnique({
      where: { id },
      include: { file: { select: { filename: true, pageCount: true, sizeBytes: true } } },
    });
    if (!result || result.userId !== req.user.id) {
      throw new HttpError(404, 'RESULT_NOT_FOUND', 'Result not found');
    }
    res.json({ result });
  } catch (err) {
    next(err);
  }
}
