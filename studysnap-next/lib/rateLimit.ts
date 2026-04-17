import { prisma } from './prisma';
import { HttpError } from './httpError';

/** Unified user-facing message for any rate-limit / cooldown rejection. */
export const MSG_LIMIT_REACHED = 'Free usage limit reached. Please wait or try later.';

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
