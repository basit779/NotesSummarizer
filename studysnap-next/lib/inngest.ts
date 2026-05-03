import { Inngest } from 'inngest';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { extractTextFromBuffer } from '@/lib/pdf';
import { analyzeText } from '@/lib/ai';
import { logUsage } from '@/lib/usage';
import { storePdfCache } from '@/lib/ai/pdfCache';
import { buildRagIndex } from '@/lib/ai/ragIndex';
import { getFallbackOrder, MODEL_REGISTRY } from '@/lib/ai/registry';
import { runOneProvider } from '@/lib/ai/runWithFallback';
import { selectTier } from '@/lib/prompts';
import type { ModelId, ProviderResult, StudyMaterial } from '@/lib/ai/types';

export type ProcessFileEventData = {
  fileId: string;
  userId: string;
  plan: 'FREE' | 'PRO';
  requestedModel?: ModelId;
};

export const inngest = new Inngest({ id: 'studysnap' });

/** Single-call threshold (matches lib/ai/chunked.ts CHUNK_THRESHOLD). Docs
 *  larger than this go through the legacy single-step `analyzeText` path
 *  which internally chunks + parallel-merges via runWithFallback. */
const CHUNK_THRESHOLD = 120_000;

/** Per-provider client-side abort timeout. 5s margin under Vercel's 60s
 *  function cap — gives DeepSeek (50-80 tok/s × ~4K minimal-flag tokens =
 *  50-80s) room to actually finish where the legacy shared-25s timeout
 *  always aborted. */
const PER_PROVIDER_TIMEOUT_MS = 55_000;

type AnalysisOutput = {
  material: StudyMaterial;
  model: string;
  tokensUsed: number;
  attempted: { id: ModelId; error?: string }[];
  chunks: number;
  sourceChars: number;
  degraded?: boolean;
  fallbackUsed: string | null;
};

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

      let analysis: AnalysisOutput;

      if (text.length > CHUNK_THRESHOLD) {
        // Multi-chunk path stays on the legacy single-step analyze. Chunking
        // already parallelizes across 3 chunks, so per-provider step splitting
        // would explode the step count without proportional benefit. Most
        // uploads are <120K chars and hit the per-provider path below.
        const r = await step.run('analyze-chunked', async () => {
          return analyzeText(text, plan, requestedModel, pages);
        });
        analysis = { ...r, fallbackUsed: r.fallbackUsed ?? null };
      } else {
        // Per-provider step orchestration. Each provider runs in its own
        // Inngest step = its own Vercel function invocation = its own 60s
        // budget. DeepSeek (paid primary) gets 55s + minimal flag, finishes
        // ~70-80% of uploads. Gemini/Groq/Mistral cover the rest with their
        // normal config in dedicated steps.
        const tier = selectTier(text.length, pages);
        const baseChain = getFallbackOrder(tier);
        const chain: ModelId[] = requestedModel && MODEL_REGISTRY[requestedModel]
          ? [requestedModel, ...baseChain.filter((id) => id !== requestedModel)]
          : baseChain;
        const configured = chain.filter((id) => MODEL_REGISTRY[id].isConfigured());

        if (configured.length === 0) {
          throw new Error('No AI provider configured. Set GOOGLE_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY, or DEEPSEEK_API_KEY.');
        }

        let result: ProviderResult | null = null;
        let usedProvider: ModelId | null = null;
        const attempted: { id: ModelId; error?: string }[] = [];

        for (const providerId of configured) {
          if (result) break;

          // DeepSeek needs minimal flag so its ~4K-token output (vs ~5-6K
          // full) fits the 55s timeout at 50-80 tok/s. Other providers run
          // full counts (their per-token speed isn't the binding constraint).
          const useMinimal = providerId === 'deepseek-v4-flash';

          const stepResult = await step.run(`analyze-${providerId}`, async () => {
            const t0 = Date.now();
            try {
              const r = await runOneProvider(providerId, text, plan, {
                pages,
                minimal: useMinimal,
                timeoutMs: PER_PROVIDER_TIMEOUT_MS,
              });
              const elapsedMs = Date.now() - t0;
              console.log(`[INNGEST][${providerId}] ✓ ${elapsedMs}ms tokens=${r.tokensUsed}`);
              return { ok: true as const, result: r, elapsedMs };
            } catch (err: any) {
              const elapsedMs = Date.now() - t0;
              const message = err?.message ?? String(err);
              console.log(`[INNGEST][${providerId}] ✗ ${elapsedMs}ms — ${message}`);
              return { ok: false as const, error: message, elapsedMs };
            }
          });

          if (stepResult.ok) {
            result = stepResult.result;
            usedProvider = providerId;
            attempted.push({ id: providerId });
          } else {
            attempted.push({ id: providerId, error: stepResult.error });
          }
        }

        if (!result || !usedProvider) {
          const summary = attempted.map((a) => `${a.id}=${a.error ?? 'ok'}`).join('; ');
          throw new Error(`All ${configured.length} providers failed: ${summary}`);
        }

        analysis = {
          ...result,
          attempted,
          chunks: 1,
          sourceChars: text.length,
          fallbackUsed: usedProvider === configured[0] ? null : usedProvider,
        };
      }

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
