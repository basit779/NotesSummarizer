import type { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { HttpError } from '../utils/httpError';
import type { AuthedRequest } from '../middleware/authMiddleware';
import { logUsage } from '../services/usageService';

export async function uploadFile(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'UNAUTHORIZED', 'Not authenticated');
    if (!req.file) throw new HttpError(400, 'NO_FILE', 'No file uploaded');

    const file = await prisma.uploadedFile.create({
      data: {
        userId: req.user.id,
        filename: req.file.originalname,
        storagePath: req.file.path,
        sizeBytes: req.file.size,
        mimeType: req.file.mimetype,
      },
    });
    await logUsage(req.user.id, 'UPLOAD');
    res.status(201).json({ file });
  } catch (err) {
    next(err);
  }
}
