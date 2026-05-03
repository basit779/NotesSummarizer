import { Inngest } from 'inngest';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { extractTextFromBuffer } from '@/lib/pdf';
import { analyzeText } from '@/lib/ai';
import { logUsage } from '@/lib/usage';
import { storePdfCache } from '@/lib/ai/pdfCache';
import { buildRagIndex } from '@/lib/ai/ragIndex';
import type { ModelId } from '@/lib/ai/types';

export type ProcessFileEventData = {
  fileId: string;
  userId: string;
  plan: 'FREE' | 'PRO';
  requestedModel?: ModelId;
};

export const inngest = new Inngest({ id: 'studysnap' });

export const processFile = inngest.createFunction(
  {
    id: 'process-file',
    name: 'Process uploaded file',
    triggers: [{ event: 'process.file' }],
    // Replaces the old in-process runSerial queue. Inngest's concurrency keys
    // are durable across the whole deployment, not just one warm Vercel
    // instance — so a user with two tabs in different regions still gets
    // serialized.
    concurrency: { key: 'event.data.userId', limit: 1 },
    // The pipeline manages its own ERROR row + writes a clear errorMessage
    // to the DB on failure. Re-running the same event would just hit the
    // same model with the same input and fail the same way, so disable
    // automatic retries — the user can re-trigger a fresh upload.
    retries: 0,
  },
  async ({ event, step }) => {
    const { fileId, userId, plan, requestedModel } = event.data as ProcessFileEventData;

    try {
      const file = await step.run('load-file', async () => {
        return prisma.uploadedFile.findUnique({ where: { id: fileId } });
      });
      if (!file) {
        console.warn(`[INNGEST] ${fileId} disappeared before background work started`);
        return { ok: false, reason: 'file_disappeared' };
      }

      const { text, pages } = await step.run('extract-text', async () => {
        if (file.storagePath.startsWith('mem:base64:')) {
          const buffer = Buffer.from(file.storagePath.slice('mem:base64:'.length), 'base64');
          const extracted = await extractTextFromBuffer(buffer, file.mimeType);
          return { text: extracted.text, pages: extracted.pages };
        }
        if (file.storagePath.startsWith('mem:text:')) {
          return {
            text: Buffer.from(file.storagePath.slice('mem:text:'.length), 'base64').toString('utf8'),
            pages: file.pageCount ?? 0,
          };
        }
        throw new Error('File storage format not recognized');
      });

      console.log(`[INNGEST] ${fileId} — ${pages} pages, ${text.length} chars, model=${requestedModel ?? 'auto'}`);

      // Analyze step is still bound by the underlying Vercel function cap
      // (60s on Hobby). The architectural win here is durability + clean
      // per-user serialization; provider physics are unchanged. Splitting
      // analyze into per-provider steps would lift each attempt out of the
      // shared 60s window — see _AI_HANDOFF.md "Option C" for that path.
      const analysis = await step.run('analyze', async () => {
        return analyzeText(text, plan, requestedModel, pages);
      });

      const { material, model, tokensUsed, attempted, chunks, sourceChars, degraded, fallbackUsed } = analysis;

      await step.run('persist-result', async () => {
        await prisma.processingResult.create({
          data: {
            fileId: file.id,
            userId,
            summary: material.summary,
            keyPoints: material.keyPoints as any,
            definitions: material.definitions as any,
            examQuestions: material.examQuestions as any,
            flashcards: material.flashcards as any,
            model,
            tokensUsed,
            fallbackUsed: fallbackUsed ?? null,
          },
        });
        // Free DB space — the base64 PDF blob is no longer needed once
        // ProcessingResult exists. Sentinel keeps the NOT NULL constraint happy.
        await prisma.uploadedFile.update({
          where: { id: file.id },
          data: {
            pageCount: pages,
            storagePath: 'consumed',
            processingAt: null,
            status: 'DONE',
            errorMessage: null,
          },
        });
        await logUsage(userId, 'UPLOAD');
        await logUsage(userId, 'PROCESS');
      });

      if (file.contentHash) {
        await step.run('cache-and-rag', async () => {
          const cacheReqId = crypto.randomBytes(6).toString('hex');
          await storePdfCache({
            contentHash: file.contentHash!,
            pack: {
              summary: material.summary,
              keyPoints: material.keyPoints,
              definitions: material.definitions,
              examQuestions: material.examQuestions,
              flashcards: material.flashcards,
              originalModel: model,
            },
            pageCount: pages,
            reqId: cacheReqId,
          });
          await buildRagIndex({ contentHash: file.contentHash!, text, reqId: cacheReqId });
        });
      }

      console.log(
        `[INNGEST] ${fileId} ✓ done — model=${model}, tokens=${tokensUsed}, attempts=${attempted.length}, chunks=${chunks}, sourceChars=${sourceChars}${
          degraded ? ', DEGRADED (pass-2 failed)' : ''
        }${fallbackUsed ? `, FALLBACK=${fallbackUsed}` : ''}`,
      );

      return { ok: true, model, tokensUsed, fallbackUsed: fallbackUsed ?? null };
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : 'Generation failed';
      console.error(`[INNGEST] ${fileId} ✗ failed — ${message}`);
      await prisma.uploadedFile.update({
        where: { id: fileId },
        data: { processingAt: null, status: 'ERROR', errorMessage: message.slice(0, 500) },
      }).catch(() => {});
      return { ok: false, reason: 'pipeline_error', message };
    }
  },
);

export const inngestFunctions = [processFile];
