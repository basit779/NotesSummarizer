import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';
import { checkDailyLimit } from '@/lib/usage';
import { env } from '@/lib/env';
import { extractTextFromPdfBuffer } from '@/lib/pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Per-user cooldown between consecutive uploads — prevents cascade duplicates if a request hangs. */
const UPLOAD_COOLDOWN_MS = 30_000;
const MAX_FILES = 3;

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

  // 1. Daily free-tier limit
  const limit = await checkDailyLimit(user.id, user.plan, 'UPLOAD');
  if (!limit.ok) {
    throw new HttpError(429, 'FREE_LIMIT_REACHED',
      `Daily upload limit reached on Free plan. Upgrade to Pro for unlimited access.`,
      { limit: limit.limit, used: limit.used, upgrade: true });
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
    throw new HttpError(400, 'TOO_MANY_FILES', `Max ${MAX_FILES} PDFs per upload`);
  }

  // Validate each file
  const files: { name: string; buffer: Buffer; sizeBytes: number }[] = [];
  let totalBytes = 0;
  for (const blob of rawFiles) {
    const name = (blob as { name?: string }).name ?? 'upload.pdf';
    const mime = blob.type || 'application/pdf';
    if (mime !== 'application/pdf') {
      throw new HttpError(400, 'BAD_MIME', `${name}: only PDF files are supported`);
    }
    if (blob.size > env.maxUploadMb * 1024 * 1024) {
      throw new HttpError(413, 'TOO_LARGE', `${name}: file exceeds ${env.maxUploadMb}MB limit`);
    }
    const buffer = Buffer.from(await blob.arrayBuffer());
    files.push({ name, buffer, sizeBytes: blob.size });
    totalBytes += blob.size;
  }

  const isMulti = files.length > 1;

  // 2. Content-hash dedup (order-independent via sorted hash of file hashes)
  const fileHashes = files.map((f) => crypto.createHash('sha256').update(f.buffer).digest('hex')).sort();
  const contentHash = crypto.createHash('sha256').update(fileHashes.join('|')).digest('hex');

  const existingHashMatch = await prisma.uploadedFile.findFirst({
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

  // 3. Cooldown check
  const since = new Date(Date.now() - UPLOAD_COOLDOWN_MS);
  const recent = await prisma.uploadedFile.findFirst({
    where: { userId: user.id, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    include: { result: { select: { id: true } } },
  });
  if (recent && !recent.result) {
    console.log(`[UPLOAD] ${user.id} — cooldown hit, returning existing fileId=${recent.id}`);
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
      mimeType: 'application/pdf',
      contentHash,
      pageCount: totalPages > 0 ? totalPages : null,
    },
    select: { id: true, filename: true, sizeBytes: true, mimeType: true, createdAt: true },
  });
  console.log(`[UPLOAD] ${user.id} created fileId=${record.id} files=${files.length} size=${totalBytes} hash=${contentHash.slice(0, 12)} ${isMulti ? '(multi)' : ''}`);
  return NextResponse.json({ file: record }, { status: 201 });
});
