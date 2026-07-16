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

/** Tighter timeout for DeepSeek pass calls. 50s gives 10s margin under
 *  Vercel's 60s wall — needed because the old 2-pass pass1 was still hitting
 *  the 55s edge and getting killed mid-cleanup (run 01KR67K3R7Y0SE6XHDNM0AEYNM,
 *  2026-05-09). The 3-way split targets ~1.5-1.8K tokens per pass with a
 *  2400-token hard cap (registry.ts), so each pass finishes in 19-36s
 *  typical, 48s absolute worst — always inside this timeout. */
const DEEPSEEK_PASS_TIMEOUT_MS = 50_000;

/** Reject a promise that runs longer than `ms`. Used to bound document text
 *  extraction — pdf-parse / mammoth / xlsx can hang on malformed input, which
 *  would otherwise ride out to Vercel's 60s function kill with no clean error. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} exceeded ${Math.round(ms / 1000)}s — file may be corrupted or unsupported`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

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
      // Defensive: the event's userId must own the file. The /process route
      // already checks this before sending the event, but a malformed/replayed
      // event must never let one user's job write under another user's id.
      if (file.userId !== userId) {
        console.error(`[INNGEST] ${fileId} ownership mismatch — file.userId=${file.userId} event.userId=${userId}, aborting`);
        return { ok: false, reason: 'ownership_mismatch' };
      }

      const { text, pages } = await step.run('extract-text', async () => {
        if (file.storagePath.startsWith('mem:base64:')) {
          const buffer = Buffer.from(file.storagePath.slice('mem:base64:'.length), 'base64');
          // 45s deadline leaves 15s margin under Vercel's 60s cap for this step.
          const extracted = await withTimeout(
            extractTextFromBuffer(buffer, file.mimeType),
            45_000,
            'Document extraction',
          );
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

          // DeepSeek + medium/long/xl tier → 3-pass PARALLEL orchestration.
          // Each pass runs as its own Inngest step = its own 60s Vercel
          // function invocation. The pack is split three ways:
          //   pass 1 → summary + keyPoints + definitions (minimal 0.7× counts)
          //   pass 3 → flashcards (full split counts, 16-20 cards)
          //   pass 4 → examQuestions + topicConnections + studyTips
          // Each pass generates ~1.5-1.8K tokens = 19-36s at DeepSeek's
          // 50-80 tok/s, far from the 50s timeout. The OLD 2-pass design had
          // to run ultraMinimal (0.5×) counts to fit and still grazed the
          // timeout — the paid provider was producing the THINNEST packs in
          // the chain. Three smaller passes = fuller pack AND bigger margin.
          //
          // Short tier uses single-pass DeepSeek — output already fits 55s
          // budget, no point paying for 3 API calls.
          //
          // Other providers (Gemini/Groq/Mistral) always single-pass — their
          // per-token speed isn't the binding constraint.
          const useDeepSeekSplit = providerId === 'deepseek-v4-flash' && tier !== 'short';

          if (useDeepSeekSplit) {
            // All passes via Promise.all — Inngest dispatches each step.run()
            // as its own function invocation in parallel.
            //
            // Step-level `retries: 0` (passed via `as any` since v4's
            // StepOptions type doesn't expose it but the runtime accepts it).
            // Without this, a failed/timed-out step gets RETRIED by Inngest —
            // observed in run 01KR67K3R7Y0SE6XHDNM0AEYNM (2026-05-09): pass1
            // step took 1m 50s = 2× ~55s, doubling the wall time. Function-
            // level retries:0 only prevents function retries, not step retries.
            const runPass = (pass: 1 | 3 | 4) =>
              step.run({ id: `analyze-${providerId}-pass${pass}`, retries: 0 } as any, async () => {
                const t0 = Date.now();
                try {
                  const r = await runOneProvider(providerId, text, plan, {
                    pages,
                    pass,
                    // Pass 1 carries three sections — trim its counts by 0.7×
                    // so its output lands in the same ~1.5-1.8K token band as
                    // passes 3/4 (which use purpose-sized split counts).
                    minimal: pass === 1,
                    timeoutMs: DEEPSEEK_PASS_TIMEOUT_MS,
                  });
                  const elapsedMs = Date.now() - t0;
                  console.log(`[INNGEST][${providerId}/pass${pass}] ✓ ${elapsedMs}ms tokens=${r.tokensUsed}`);
                  return { ok: true as const, result: r, elapsedMs };
                } catch (err: any) {
                  const elapsedMs = Date.now() - t0;
                  const message = err?.message ?? String(err);
                  console.log(`[INNGEST][${providerId}/pass${pass}] ✗ ${elapsedMs}ms — ${message}`);
                  return { ok: false as const, error: message, elapsedMs };
                }
              });

            const [pass1, pass3, pass4] = await Promise.all([runPass(1), runPass(3), runPass(4)]);

            // All passes must succeed for DeepSeek to "win" this upload.
            // Partial success isn't useful — a pack without a summary or
            // without flashcards isn't a complete pack. If any pass fails,
            // advance to the next provider in the chain.
            if (pass1.ok && pass3.ok && pass4.ok) {
              const merged: StudyMaterial = {
                title: pass1.result.material.title,
                summary: pass1.result.material.summary,
                keyPoints: pass1.result.material.keyPoints,
                definitions: pass1.result.material.definitions,
                flashcards: pass3.result.material.flashcards,
                examQuestions: pass4.result.material.examQuestions,
                topicConnections: pass4.result.material.topicConnections,
                studyTips: pass4.result.material.studyTips,
              };
              result = {
                material: merged,
                model: providerId,
                tokensUsed: pass1.result.tokensUsed + pass3.result.tokensUsed + pass4.result.tokensUsed,
              };
              usedProvider = providerId;
              attempted.push({ id: providerId });
              console.log(`[INNGEST][${providerId}] 3-pass merged: pass1=${pass1.elapsedMs}ms pass3=${pass3.elapsedMs}ms pass4=${pass4.elapsedMs}ms`);
            } else {
              const errSummary = `pass1=${pass1.ok ? 'ok' : pass1.error}; pass3=${pass3.ok ? 'ok' : pass3.error}; pass4=${pass4.ok ? 'ok' : pass4.error}`;
              attempted.push({ id: providerId, error: `3-pass failed: ${errSummary}` });
              console.log(`[INNGEST][${providerId}] 3-pass FAILED — ${errSummary}, advancing chain`);
            }
            continue;
          }

          // Single-pass path (Gemini/Groq/Mistral always; DeepSeek for short tier)
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
        // Upsert (keyed by the unique fileId) instead of create — if Inngest
        // re-invokes this step after a transient (DB committed but the step ack
        // was lost), a plain create() would throw P2002 and the catch would
        // mark the file ERROR even though the pack exists. Upsert is idempotent.
        const resultData = {
          summary: material.summary,
          keyPoints: material.keyPoints as any,
          definitions: material.definitions as any,
          examQuestions: material.examQuestions as any,
          flashcards: material.flashcards as any,
          // These were generated by the AI but previously dropped on the floor
          // — the schema had no columns, so the "Study tips" tab was always empty.
          title: material.title ?? null,
          topicConnections: (material.topicConnections ?? null) as any,
          studyTips: (material.studyTips ?? null) as any,
          model,
          tokensUsed,
          fallbackUsed: fallbackUsed ?? null,
        };
        await prisma.processingResult.upsert({
          where: { fileId: file.id },
          create: { fileId: file.id, userId, ...resultData },
          update: resultData,
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
              title: material.title,
              topicConnections: material.topicConnections,
              studyTips: material.studyTips,
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
