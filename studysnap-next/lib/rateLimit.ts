import { prisma } from './prisma';
import { HttpError } from './httpError';

/** Unified user-facing message for any rate-limit / cooldown rejection. */
export const MSG_LIMIT_REACHED = 'Free usage limit reached. Please wait or try later.';

/** Best-effort client IP from Vercel/proxy headers. x-forwarded-for is a
 *  comma-list (client, proxy1, ...) — take the first. Falls back to a constant
 *  so a missing header collapses all callers into one bucket (fail-closed-ish)
 *  rather than disabling the limit. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * DB-backed sliding-window rate limit for pre-auth / abuse-prone endpoints
 * (login, signup, password reset). Counts attempts for `key` within the window;
 * throws 429 if the limit is hit, otherwise records this attempt. Shared across
 * all serverless instances (unlike an in-memory counter, which resets per cold
 * start). Opportunistically prunes old rows for the same key to bound growth.
 */
export async function enforceAuthRateLimit(opts: {
  key: string;
  maxAttempts: number;
  windowSeconds: number;
  message?: string;
}): Promise<void> {
  const { key, maxAttempts, windowSeconds, message } = opts;
  const since = new Date(Date.now() - windowSeconds * 1000);
  const count = await prisma.authAttempt.count({ where: { key, createdAt: { gte: since } } });
  if (count >= maxAttempts) {
    throw new HttpError(
      429,
      'TOO_MANY_ATTEMPTS',
      message ?? 'Too many attempts. Please wait a bit and try again.',
      { retryAfterSeconds: windowSeconds },
    );
  }
  await prisma.authAttempt.create({ data: { key } });
  // Bounded cleanup: drop this key's rows older than the window (cheap, keeps
  // the table from growing unbounded without a cron). Best-effort.
  prisma.authAttempt.deleteMany({ where: { key, createdAt: { lt: since } } }).catch(() => {});
}

interface CooldownArgs {
  userId: string;
  cooldownSeconds: number;
  /** Override the default user-facing message (e.g. "Wait between messages"). */
  message?: string;
}

/**
 * Reject if the user kicked off an upload too recently. Uses UploadedFile.createdAt
 * as the timestamp source — every /upload attempt creates a row, including failed
 * ones, so spam-clicking is detected regardless of processing state.
 */
export async function enforceUploadCooldown({ userId, cooldownSeconds, message }: CooldownArgs): Promise<void> {
  const since = new Date(Date.now() - cooldownSeconds * 1000);
  const recent = await prisma.uploadedFile.findFirst({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!recent) return;
  const retryAfter = Math.max(1, Math.ceil(cooldownSeconds - (Date.now() - recent.createdAt.getTime()) / 1000));
  throw new HttpError(
    429,
    'COOLDOWN_ACTIVE',
    message ?? MSG_LIMIT_REACHED,
    { retryAfterSeconds: retryAfter },
  );
}

/** Reject if the user sent a chat message too recently. */
export async function enforceChatCooldown({ userId, cooldownSeconds, message }: CooldownArgs): Promise<void> {
  const since = new Date(Date.now() - cooldownSeconds * 1000);
  const recent = await prisma.chatMessage.findFirst({
    where: { userId, role: 'user', createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!recent) return;
  const retryAfter = Math.max(1, Math.ceil(cooldownSeconds - (Date.now() - recent.createdAt.getTime()) / 1000));
  throw new HttpError(
    429,
    'COOLDOWN_ACTIVE',
    message ?? 'Please wait a moment between messages.',
    { retryAfterSeconds: retryAfter },
  );
}
