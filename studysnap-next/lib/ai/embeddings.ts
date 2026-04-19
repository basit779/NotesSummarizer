/**
 * Gemini text-embedding-004 helper with EmbeddingCache-backed memoization.
 *
 * Serves both callers of the RAG system:
 *   - Chunk embeddings — written at /process time, one per unique chunk text.
 *   - Question embeddings — written on first retrieval of a given question,
 *     read on repeat asks of the same question against any doc.
 *
 * Cache key is sha256 of the embedded text. The `model` column lets us swap
 * to a newer embedding model later without wiping old rows — retrieval
 * filters by model, reads stay consistent per model era.
 *
 * Vectors stored as raw Float32Array bytes (768 dims × 4 = 3072 B per row)
 * to dodge the pgvector dependency. Node Buffer ↔ Float32Array zero-copies
 * via the underlying ArrayBuffer.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

export const EMBED_MODEL = 'text-embedding-004';
export const EMBED_DIMS = 768;

export function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** Zero-copy Float32Array → Buffer for DB write. */
export function serializeVector(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

/** Zero-copy Buffer → Float32Array for DB read. Copies into a fresh
 *  ArrayBuffer when the source buffer isn't aligned on a 4-byte boundary
 *  (Prisma's Bytes driver returns Node Buffer whose byteOffset is usually 0
 *  but not guaranteed). */
export function deserializeVector(buf: Buffer): Float32Array {
  if (buf.byteOffset % 4 === 0 && buf.byteLength % 4 === 0) {
    return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  }
  const copy = new ArrayBuffer(buf.byteLength);
  new Uint8Array(copy).set(buf);
  return new Float32Array(copy);
}

interface EmbedSingleResult {
  vector: Float32Array;
  cacheHit: boolean;
  textHash: string;
}

/**
 * Embed a single text — hits cache first, falls through to Gemini on miss,
 * writes back to cache. Throws on network/API failure (caller decides how
 * to degrade).
 */
export async function embedOne(text: string): Promise<EmbedSingleResult> {
  const textHash = hashText(text);
  const cached = await prisma.embeddingCache.findUnique({ where: { textHash } });
  if (cached && cached.model === EMBED_MODEL) {
    return { vector: deserializeVector(Buffer.from(cached.vector)), cacheHit: true, textHash };
  }

  const vector = await callGeminiEmbedSingle(text);
  await prisma.embeddingCache.upsert({
    where: { textHash },
    create: { textHash, vector: serializeVector(vector), model: EMBED_MODEL },
    update: { vector: serializeVector(vector), model: EMBED_MODEL },
  });
  return { vector, cacheHit: false, textHash };
}

interface EmbedBatchResult {
  vectors: Float32Array[];
  cacheHits: number;
  newEmbeds: number;
  textHashes: string[];
}

/**
 * Embed N texts in one pass. Checks cache for all first (single IN query),
 * sends only the misses through Gemini's batchEmbedContents endpoint, writes
 * results back. One round-trip to Postgres, at most one round-trip to Gemini.
 */
export async function embedBatch(texts: string[]): Promise<EmbedBatchResult> {
  const textHashes = texts.map(hashText);
  const cached = await prisma.embeddingCache.findMany({
    where: { textHash: { in: textHashes }, model: EMBED_MODEL },
    select: { textHash: true, vector: true },
  });
  const cacheMap = new Map<string, Float32Array>();
  for (const row of cached) {
    cacheMap.set(row.textHash, deserializeVector(Buffer.from(row.vector)));
  }

  const misses: { idx: number; text: string; hash: string }[] = [];
  texts.forEach((t, i) => {
    if (!cacheMap.has(textHashes[i])) misses.push({ idx: i, text: t, hash: textHashes[i] });
  });

  if (misses.length > 0) {
    const fresh = await callGeminiEmbedBatch(misses.map((m) => m.text));
    // Upsert each fresh embedding. Sequential is fine — typical batch = 30
    // misses on first chunking, 0 on re-chunk, <=1 on question embed.
    for (let i = 0; i < misses.length; i++) {
      const m = misses[i];
      const vec = fresh[i];
      cacheMap.set(m.hash, vec);
      await prisma.embeddingCache.upsert({
        where: { textHash: m.hash },
        create: { textHash: m.hash, vector: serializeVector(vec), model: EMBED_MODEL },
        update: { vector: serializeVector(vec), model: EMBED_MODEL },
      });
    }
  }

  const vectors = textHashes.map((h) => cacheMap.get(h)!);
  return { vectors, cacheHits: texts.length - misses.length, newEmbeds: misses.length, textHashes };
}

/** Raw Gemini embed call — single text. */
async function callGeminiEmbedSingle(text: string): Promise<Float32Array> {
  const key = env.googleApiKey;
  if (!key) throw new Error('GOOGLE_API_KEY not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini embed failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = await res.json() as { embedding?: { values?: number[] } };
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIMS) {
    throw new Error(`Gemini embed returned malformed response (len=${values?.length ?? 'nil'})`);
  }
  return new Float32Array(values);
}

/** Raw Gemini embed call — batched. Uses the batchEmbedContents endpoint so
 *  a 30-chunk document ships in one HTTP round trip. */
async function callGeminiEmbedBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const key = env.googleApiKey;
  if (!key) throw new Error('GOOGLE_API_KEY not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${key}`;
  const body = {
    requests: texts.map((t) => ({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text: t }] },
    })),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Gemini batch embed failed: ${res.status} ${errBody.slice(0, 200)}`);
  }
  const data = await res.json() as { embeddings?: Array<{ values?: number[] }> };
  const list = data?.embeddings;
  if (!Array.isArray(list) || list.length !== texts.length) {
    throw new Error(`Gemini batch embed returned ${list?.length ?? 'nil'} embeddings for ${texts.length} inputs`);
  }
  return list.map((e, i) => {
    const v = e?.values;
    if (!Array.isArray(v) || v.length !== EMBED_DIMS) {
      throw new Error(`Batch embed row ${i} malformed (len=${v?.length ?? 'nil'})`);
    }
    return new Float32Array(v);
  });
}
