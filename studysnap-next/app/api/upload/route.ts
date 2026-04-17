import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';
import { checkDailyLimit } from '@/lib/usage';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Per-user cooldown between consecutive uploads — prevents cascade duplicates if a request hangs. */
const UPLOAD_COOLDOWN_MS = 30_000;

/**
 * In-memory upload — no disk storage (Vercel-compatible).
 * PDF bytes base64'd into Postgres briefly, then processed + cleared by /process.
 *
 * Dedup: SHA-256 of the bytes is computed up-front. If this user has already
 * uploaded the same PDF and it has a ProcessingResult, we return the existing
 * fileId — /process/[fileId] will hit its result cache and skip the AI call.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireAuth(req);

  // 1. Daily free-tier limit (based on completed generations, not uploads)
  const limit = await checkDailyLimit(user.id, user.plan, 'UPLOAD');
  if (!limit.ok) {
    throw new HttpError(429, 'FREE_LIMIT_REACHED',
      `Daily upload limit reached on Free plan. Upgrade to Pro for unlimited access.`,
      { limit: limit.limit, used: limit.used, upgrade: true });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    throw new HttpError(400, 'NO_FILE', 'No file uploaded');
  }
  const filename = (file as any).name ?? 'upload.pdf';
  const mimeType = file.type || 'application/pdf';
  const sizeBytes = file.size;

  if (mimeType !== 'application/pdf') {
    throw new HttpError(400, 'BAD_MIME', 'Only PDF files are supported');
  }
  if (sizeBytes > env.maxUploadMb * 1024 * 1024) {
    throw new HttpError(413, 'TOO_LARGE', `File exceeds ${env.maxUploadMb}MB limit`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // 2. Content-hash dedup — if this user already processed the same PDF, reuse it.
  //    Saves a full AI call + an upload cooldown hit.
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

  // 3. Cooldown check: if user created an UploadedFile in the last 30s AND hasn't processed it,
  //    reject as duplicate and hand back the pending file id.
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

  const storagePath = `mem:base64:${buffer.toString('base64')}`;

  const record = await prisma.uploadedFile.create({
    data: { userId: user.id, filename, storagePath, sizeBytes, mimeType, contentHash },
    select: { id: true, filename: true, sizeBytes: true, mimeType: true, createdAt: true },
  });
  console.log(`[UPLOAD] ${user.id} created fileId=${record.id} filename=${filename} size=${sizeBytes} hash=${contentHash.slice(0, 12)}`);
  // Usage counted on successful /process, not here.
  return NextResponse.json({ file: record }, { status: 201 });
});
