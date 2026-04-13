import type { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { HttpError } from '../utils/httpError';
import type { AuthedRequest } from '../middleware/authMiddleware';
import { extractTextFromPdf } from '../services/pdfService';
import { analyzeText } from '../services/aiService';
import { logUsage } from '../services/usageService';

export async function processFile(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'UNAUTHORIZED', 'Not authenticated');
    const { fileId } = req.params;

    const file = await prisma.uploadedFile.findUnique({ where: { id: fileId }, include: { result: true } });
    if (!file || file.userId !== req.user.id) {
      throw new HttpError(404, 'FILE_NOT_FOUND', 'File not found');
    }
    if (file.result) {
      return res.json({ result: file.result, cached: true });
    }

    const { text, pages } = await extractTextFromPdf(file.storagePath);
    const { material, model, tokensUsed } = await analyzeText(text, req.user.plan);

    const result = await prisma.processingResult.create({
      data: {
        fileId: file.id,
        userId: req.user.id,
        summary: material.summary,
        keyPoints: material.keyPoints as any,
        definitions: material.definitions as any,
        examQuestions: material.examQuestions as any,
        flashcards: material.flashcards as any,
        model,
        tokensUsed,
      },
    });
    await prisma.uploadedFile.update({ where: { id: file.id }, data: { pageCount: pages } });
    await logUsage(req.user.id, 'PROCESS');

    res.status(201).json({ result, cached: false });
  } catch (err) {
    next(err);
  }
}
