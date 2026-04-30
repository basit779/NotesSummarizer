import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';
import { checkDailyLimit } from '@/lib/usage';
import { env, isTestUser } from '@/lib/env';
import { extractTextFromPdfBuffer, SUPPORTED_MIMES, inferMimeFromFilename } from '@/lib/pdf';
import { enforceUploadCooldown, MSG_LIMIT_REACHED } from '@/lib/rateLimit';
import { lookupPdfCache } from '@/lib/ai/pdfCache';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Min seconds between consecutive upload attempts — spam / accidental re-clicks. */
const UPLOAD_COOLDOWN_SECONDS = 15;
/** Legacy pending-upload window — if a recent upload has no result yet, surface its id. */
const PENDING_COOLDOWN_MS = 30_000;
const MAX_FILES = 1;

/**
 * Upload route — accepts 1-3 PDFs. Single-file: stored as raw PDF bytes
 * (mem:base64:...) and the /process route does the text extraction. Multi-file:
 * text is extracted here, files are concatenated with filename headers, and
 * the combined TEXT is stored (mem:text:...) so /process can skip re-parsing.
 *
 * Dedup: SHA-256 computed over the concatenated buffers. Re-uploading the same
 * set (in any order) hits the cache — the hash is sorted before digesting.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireAuth(req);

  // ?fresh=1 + allowlisted test user email → bypass all caches (user dedup,
  // cross-user PdfCache, cooldown). Lets the owner re-test AI pipeline
  // changes on a PDF that already has a cached pack, without blowing
  // away other users' cache hits. Normal users get HTTP 403 if they try.
  const freshParam = new URL(req.url).searchParams.get('fresh') === '1';
  const forceFresh = freshParam && isTestUser(user.email);
  if (freshParam && !forceFresh) {
    throw new HttpError(403, 'FRESH_NOT_ALLOWED', 'Fresh regen is not enabled for this account.');
  }

  // 1. Daily free-tier limit
  const limit = await checkDailyLimit(user.id, user.plan, 'UPLOAD');
  if (!limit.ok) {
    throw new HttpError(429, 'FREE_LIMIT_REACHED',
      MSG_LIMIT_REACHED,
      { limit: limit.limit, used: limit.used, upgrade: true });
  }

  // 1b. Per-user cooldown — 15s between upload attempts. Protects free-tier
  //     Gemini / Groq quotas from rapid repeated submissions. Skipped under
  //     forceFresh so the test account can iterate rapidly.
  if (!forceFresh) {
    await enforceUploadCooldown({ userId: user.id, cooldownSeconds: UPLOAD_COOLDOWN_SECONDS });
  }

  const formData = await req.formData();
  // Accept either `file` (single) or `files` (multiple) — keeps single-file
  // clients working while enabling drag-multiple from the new upload UI.
  const rawFiles: Blob[] = [];
  for (const v of formData.getAll('files')) if (v instanceof Blob) rawFiles.push(v);
  for (const v of formData.getAll('file')) if (v instanceof Blob) rawFiles.push(v);

  if (rawFiles.length === 0) {
    throw new HttpError(400, 'NO_FILE', 'No file uploaded');
  }
  if (rawFiles.length > MAX_FILES) {
    throw new HttpError(400, 'TOO_MANY_FILES', 'Only 1 PDF per upload');
  }

  // Validate each file. Accept any SUPPORTED_MIMES; fall back to filename
  // sniff when blob.type is empty (some browsers send empty MIME for DOCX).
  const files: { name: string; buffer: Buffer; sizeBytes: number; mime: string }[] = [];
  let totalBytes = 0;
  for (const blob of rawFiles) {
    const name = (blob as { name?: string }).name ?? 'upload';
    const mime = blob.type || inferMimeFromFilename(name);
    if (!SUPPORTED_MIMES.has(mime)) {
      throw new HttpError(400, 'BAD_MIME', `${name}: only PDF, DOCX, and PPTX files are supported`);
    }
    if (blob.size > env.maxUploadMb * 1024 * 1024) {
      throw new HttpError(413, 'TOO_LARGE', `${name}: file exceeds ${env.maxUploadMb}MB limit`);
    }
    const buffer = Buffer.from(await blob.arrayBuffer());
    files.push({ name, buffer, sizeBytes: blob.size, mime });
    totalBytes += blob.size;
  }

  const isMulti = files.length > 1;

  // 2. Content-hash dedup (order-independent via sorted hash of file hashes)
  const fileHashes = files.map((f) => crypto.createHash('sha256').update(f.buffer).digest('hex')).sort();
  const contentHash = crypto.createHash('sha256').update(fileHashes.join('|')).digest('hex');

  const existingHashMatch = forceFresh ? null : await prisma.uploadedFile.findFirst({
    where: { userId: user.id, contentHash },
    orderBy: { createdAt: 'desc' },
    include: { result: { select: { id: true } } },
  });
  if (existingHashMatch?.result) {
    console.log(`[UPLOAD] ${user.id} content-hash dedup hit — reusing fileId=${existingHashMatch.id} (0 AI calls)`);
    return NextResponse.json({
      file: {
        id: existingHashMatch.id,
        filename: existingHashMatch.filename,
        sizeBytes: existingHashMatch.sizeBytes,
        mimeType: existingHashMatch.mimeType,
        createdAt: existingHashMatch.createdAt,
      },
      deduped: true,
    }, { status: 200 });
  }

  // 2b. Cross-user PDF cache lookup. Same content hash uploaded by anyone else
  //     before? Reuse their pack — materialize a fresh UploadedFile +
  //     ProcessingResult for this user in one transaction. No AI calls.
  const reqId = crypto.randomBytes(6).toString('hex');
  const cacheHit = forceFresh ? null : await lookupPdfCache(contentHash, reqId);
  if (forceFresh) {
    console.log(`[UPLOAD] ${user.id} forceFresh=true — bypassing user dedup + PdfCache lookup for hash=${contentHash.slice(0, 12)}`);
  }
  if (cacheHit) {
    const combinedFilename = rawFiles.length > 1
      ? files.map((f) => f.name).join(' + ')
      : files[0].name;
    const newFile = await prisma.$transaction(async (tx) => {
      const uf = await tx.uploadedFile.create({
        data: {
          userId: user.id,
          filename: combinedFilename,
          storagePath: 'consumed',
          sizeBytes: totalBytes,
          mimeType: files[0].mime,
          contentHash,
          pageCount: cacheHit.pageCount,
        },
      });
      await tx.processingResult.create({
        data: {
          fileId: uf.id,
          userId: user.id,
          summary: cacheHit.pack.summary,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          keyPoints: cacheHit.pack.keyPoints as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          definitions: cacheHit.pack.definitions as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          examQuestions: cacheHit.pack.examQuestions as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          flashcards: cacheHit.pack.flashcards as any,
          model: 'pdf_cache',
          tokensUsed: 0,
        },
      });
      return uf;
    });
    console.log(`[UPLOAD] ${user.id} cross-user cache hit — hash=${contentHash.slice(0, 12)} hitCount=${cacheHit.hitCount} origModel=${cacheHit.pack.originalModel} (0 AI calls)`);
    return NextResponse.json({
      file: {
        id: newFile.id,
        filename: newFile.filename,
        sizeBytes: newFile.sizeBytes,
        mimeType: newFile.mimeType,
        createdAt: newFile.createdAt,
      },
      deduped: true,
      cacheSource: 'cross-user',
    }, { status: 200 });
  }

  // 3. Pending-upload check — a recent upload hasn't finished processing yet.
  //    Hand back its id rather than starting a duplicate job.
  const since = new Date(Date.now() - PENDING_COOLDOWN_MS);
  const recent = await prisma.uploadedFile.findFirst({
    where: { userId: user.id, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    include: { result: { select: { id: true } } },
  });
  if (recent && !recent.result) {
    console.log(`[UPLOAD] ${user.id} — pending upload, returning existing fileId=${recent.id}`);
    throw new HttpError(429, 'UPLOAD_COOLDOWN',
      'A recent upload is still processing. Using the existing one.',
      { fileId: recent.id });
  }

  // Storage strategy:
  // - Single PDF: store raw bytes as mem:base64:<b64>. /process will extract.
  // - Multiple PDFs: extract text from each here, concatenate with filename
  //   headers, store as mem:text:<b64 of combined text>. /process skips parse.
  let storagePath: string;
  let combinedFilename: string;
  let totalPages = 0;

  if (isMulti) {
    const parts: string[] = [];
    for (const f of files) {
      try {
        const { text, pages } = await extractTextFromPdfBuffer(f.buffer);
        totalPages += pages;
        parts.push(`# From: ${f.name}\n\n${text}`);
      } catch (err) {
        throw new HttpError(400, 'PARSE_FAILED', `Could not extract text from ${f.name}`);
      }
    }
    const combinedText = parts.join('\n\n---\n\n');
    storagePath = `mem:text:${Buffer.from(combinedText, 'utf8').toString('base64')}`;
    combinedFilename = files.map((f) => f.name).join(' + ');
  } else {
    storagePath = `mem:base64:${files[0].buffer.toString('base64')}`;
    combinedFilename = files[0].name;
  }

  const record = await prisma.uploadedFile.create({
    data: {
      userId: user.id,
      filename: combinedFilename,
      storagePath,
      sizeBytes: totalBytes,
      mimeType: files[0].mime,
      contentHash,
      pageCount: totalPages > 0 ? totalPages : null,
    },
    select: { id: true, filename: true, sizeBytes: true, mimeType: true, createdAt: true },
  });
  console.log(`[UPLOAD] ${user.id} created fileId=${record.id} files=${files.length} size=${totalBytes} hash=${contentHash.slice(0, 12)} ${isMulti ? '(multi)' : ''}`);
  return NextResponse.json({ file: record }, { status: 201 });
});
