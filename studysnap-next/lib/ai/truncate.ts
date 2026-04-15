/**
 * Per-model input token budgets (for PDF text only — leaves headroom for system + user prompt + output).
 * Heuristic: 1 token ≈ 4 chars of English text.
 */
const TOKEN_BUDGETS: Record<string, number> = {
  'gemini-2.5-pro': 30_000,
  'gemini-2.0-flash': 30_000,
  'groq-llama-3.3-70b': 6_000,
  'groq-llama-3.1-8b': 6_000,
  'openrouter-deepseek': 10_000,
  'mistral-small': 8_000,
  'github-gpt-4o-mini': 7_000,
  'github-llama-3.3-70b': 7_000,
};

const DEFAULT_TOKENS = 6_000;

export function truncateForModel(text: string, modelId: string): string {
  const tokens = TOKEN_BUDGETS[modelId] ?? DEFAULT_TOKENS;
  const maxChars = tokens * 4;
  if (text.length <= maxChars) return text;
  const head = text.slice(0, maxChars);
  console.log(`[AI] truncated text for ${modelId}: ${text.length} → ${head.length} chars (~${tokens} tok budget)`);
  return head + '\n\n[...document truncated to fit model context window...]';
}
