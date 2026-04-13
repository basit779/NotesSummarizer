import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';
import { logUsage, checkDailyLimit } from '@/lib/usage';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * In-memory upload — no disk storage (Vercel-compatible).
 * We persist file metadata + the raw buffer is base64-encoded in `storagePath`
 * so /process can read it back without disk I/O.
 *
 * NOTE: For a production setup, swap this for Vercel Blob or S3. For now
 * the buffer round-trip lives inside Postgres bytea via base64 string.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireAuth(req);

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
  // store as base64 in storagePath. For multi-MB PDFs this works on Postgres TEXT.
  const storagePath = `mem:base64:${buffer.toString('base64')}`;

  const record = await prisma.uploadedFile.create({
    data: {
      userId: user.id,
      filename,
      storagePath,
      sizeBytes,
      mimeType,
    },
    select: { id: true, filename: true, sizeBytes: true, mimeType: true, createdAt: true },
  });
  await logUsage(user.id, 'UPLOAD');

  return NextResponse.json({ file: record }, { status: 201 });
});
