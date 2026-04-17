import crypto from 'crypto';

/**
 * Tiny in-process LRU cache for repeated AI responses. Keyed by SHA-256 of
 * whatever the caller considers the "prompt signature".
 *
 * Survives warm Vercel serverless instances (several minutes) but not cold
 * starts — which is fine, since the prisma-backed result cache covers the
 * durable case. This layer targets the "user asks the same question twice
 * in the same session" pattern that would otherwise burn a free-tier call.
 */
const MAX_ENTRIES = 200;
const TTL_MS = 30 * 60 * 1000; // 30 min

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function hashKey(...parts: Array<string | number | null | undefined>): string {
  const normalized = parts.map((p) => (p == null ? '' : String(p))).join('\x1f');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  // Move to MRU position
  store.delete(key);
  store.set(key, entry);
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T): void {
  if (store.size >= MAX_ENTRIES) {
    // Drop oldest (first inserted — Map preserves insertion order)
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function cacheStats(): { size: number; maxEntries: number; ttlMs: number } {
  return { size: store.size, maxEntries: MAX_ENTRIES, ttlMs: TTL_MS };
}
