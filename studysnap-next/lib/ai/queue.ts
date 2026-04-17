/**
 * Per-user in-memory serialization queue. Prevents the same user from
 * triggering two concurrent AI pipelines (e.g. background tab + foreground),
 * which would burn quota twice. Requests chain off the previous promise.
 *
 * Scope: one process / region. Fine for Vercel serverless since concurrent
 * invocations of the same route share process only within a single warm
 * instance — across instances the DB-level idempotency lock takes over.
 *
 * No eviction logic: map entries are cleared as chained promises settle.
 */
const userLocks = new Map<string, Promise<unknown>>();

export async function runSerial<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = userLocks.get(userId) ?? Promise.resolve();
  // Chain: wait for previous work to settle (succeed or fail), then run ours.
  const next = prev.catch(() => undefined).then(() => fn());
  userLocks.set(userId, next);
  try {
    return await next;
  } finally {
    // If our promise is still the head of the chain, clear it so the next
    // request starts fresh rather than stacking on finished work.
    if (userLocks.get(userId) === next) userLocks.delete(userId);
  }
}

export function queueDepth(userId: string): boolean {
  return userLocks.has(userId);
}
