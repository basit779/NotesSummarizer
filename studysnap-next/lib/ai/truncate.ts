/**
 * Per-model input token budgets for PDF text (leaves headroom for system + user prompt + output).
 * Heuristic: 1 token ≈ 4 characters.
 */
const TOKEN_BUDGETS: Record<string, number> = {
  'gemini-2.5-pro': 25_000,
  'gemini-2.0-flash': 25_000,
  'groq-llama-3.3-70b': 5_500,
  'groq-llama-3.1-8b': 5_500,
  'openrouter-deepseek': 10_000,
  'mistral-small': 8_000,
  'github-gpt-4o-mini': 7_000,
  'github-llama-3.3-70b': 7_000,
};

const DEFAULT_TOKENS = 5_500;
const CHARS_PER_TOKEN = 4;

const TRUNCATION_NOTE =
  '[NOTE: This is a truncated version of a longer document. Sections from the beginning, middle, and end are included. Generate comprehensive study materials covering all visible topics.]\n\n';

/**
 * Smart truncation: keep the first 30% and last 20% verbatim,
 * then sample evenly from the middle 50% so the AI sees full document scope.
 */
export function smartTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const budget = maxChars - TRUNCATION_NOTE.length - 200; // leave room for separators
  const headLen = Math.floor(budget * 0.30);
  const tailLen = Math.floor(budget * 0.20);
  const midLen = budget - headLen - tailLen;

  const head = text.slice(0, headLen);
  const tail = text.slice(text.length - tailLen);

  // Middle 50% of source, sampled in evenly-spaced chunks.
  const midStart = headLen;
  const midEnd = text.length - tailLen;
  const midSource = text.slice(midStart, midEnd);
  const sampleCount = 8;
  const chunkSize = Math.floor(midLen / sampleCount);
  const step = Math.floor(midSource.length / sampleCount);

  const midParts: string[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const s = i * step;
    midParts.push(midSource.slice(s, s + chunkSize));
  }

  return (
    TRUNCATION_NOTE +
    head +
    '\n\n[...middle sections sampled...]\n\n' +
    midParts.join('\n\n[...]\n\n') +
    '\n\n[...continuing to end...]\n\n' +
    tail
  );
}

export function truncateForModel(text: string, modelId: string): string {
  const tokens = TOKEN_BUDGETS[modelId] ?? DEFAULT_TOKENS;
  const maxChars = tokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  const out = smartTruncate(text, maxChars);
  console.log(`[AI] smart-truncated for ${modelId}: ${text.length} → ${out.length} chars (~${tokens} tok budget)`);
  return out;
}

/** Document-level check: was this PDF big enough that we'll truncate for all models? */
export function willTruncate(text: string): boolean {
  return text.length > 25_000 * CHARS_PER_TOKEN; // 100k chars
}
