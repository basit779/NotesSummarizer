/**
 * RAG retrieval — cosine similarity over chunk embeddings, keyed by
 * contentHash. Loads every chunk + its cached embedding in one pass, ranks
 * by cosine sim with the question embedding, returns the top K.
 *
 * Expected perf: <500ms for 30-chunk / 4-return on warm cache. Cold (first
 * question on a doc) adds one Gemini embed round-trip, ~300-500ms.
 */

import { prisma } from '@/lib/prisma';
import { embedOne, hashText, deserializeVector, EMBED_MODEL } from './embeddings';

export interface RetrievalHit {
  chunkIndex: number;
  text: string;
  score: number;
}

/** dot(a,b) / (||a|| * ||b||). Assumes equal-length Float32Arrays. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, aMag = 0, bMag = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aMag += a[i] * a[i];
    bMag += b[i] * b[i];
  }
  const denom = Math.sqrt(aMag) * Math.sqrt(bMag);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Retrieve top-K chunks most relevant to `question` for the given document.
 * Returns [] if the doc has no chunks (caller falls back to legacy context).
 *
 * Query plan: load all chunks for contentHash (~30 rows, indexed), hash each
 * chunk's text to look up its embedding (single IN query against
 * embedding_cache @id), score locally, sort, slice. No full table scans.
 */
export async function retrieveTopK(
  contentHash: string,
  question: string,
  k = 4,
): Promise<RetrievalHit[]> {
  const chunks = await prisma.pdfChunk.findMany({
    where: { contentHash },
    orderBy: { chunkIndex: 'asc' },
    select: { chunkIndex: true, text: true },
  });
  if (chunks.length === 0) return [];

  const chunkHashes = chunks.map((c) => hashText(c.text));
  const cached = await prisma.embeddingCache.findMany({
    where: { textHash: { in: chunkHashes }, model: EMBED_MODEL },
    select: { textHash: true, vector: true },
  });
  const vecMap = new Map<string, Float32Array>();
  for (const row of cached) {
    vecMap.set(row.textHash, deserializeVector(Buffer.from(row.vector)));
  }

  const { vector: qVec } = await embedOne(question);

  // Score every chunk that has an embedding. Missing embeddings (shouldn't
  // happen post-index but possible if /process partially wrote) get score 0
  // so they don't crash retrieval but stay last in ranking.
  const scored = chunks.map((c, i) => {
    const vec = vecMap.get(chunkHashes[i]);
    const score = vec ? cosineSimilarity(qVec, vec) : 0;
    return { chunkIndex: c.chunkIndex, text: c.text, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
