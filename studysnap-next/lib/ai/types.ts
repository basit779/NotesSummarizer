export interface ExamQuestion {
  question: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  options?: string[];
  correct?: string;
  explanation?: string;
}

export interface StudyMaterial {
  title?: string;
  summary: string;
  keyPoints: string[];
  definitions: { term: string; definition: string }[];
  examQuestions: ExamQuestion[];
  flashcards: { front: string; back: string }[];
  topicConnections?: string[];
  studyTips?: string[];
}

export type ModelId =
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.0-flash'
  | 'groq-llama-3.3-70b'
  | 'groq-llama-3.1-8b'
  | 'openrouter-free'
  | 'mistral-small'
  | 'github-gpt-4o-mini'
  | 'github-llama-3.3-70b'
  | 'deepseek-v4-flash';

export interface ProviderResult {
  material: StudyMaterial;
  model: string;
  tokensUsed: number;
}

export interface ProviderRunOptions {
  /** Retry mode: use a trimmed prompt so output fits in the model's max_tokens cap.
   *  Scales TIER_COUNTS by ~0.7×. */
  minimal?: boolean;
  /** Aggressive trim: scales TIER_COUNTS by ~0.5×. Used ONLY for DeepSeek pass
   *  calls in lib/inngest.ts where physics demand even smaller output to fit
   *  the 55s timeout reliably (50-80 tok/s × 1.5K tokens = 19-30s, vs 30-60s
   *  with regular minimal). Other providers don't need this — their per-token
   *  speed isn't the binding constraint. */
  ultraMinimal?: boolean;
  /** Number of PDF pages (if known). Used by the prompt builder for tier
   *  selection — slide-heavy PDFs need page signal, not just char count. */
  pages?: number;
  /** XL 2-pass signal. 1 = notes half (summary + keyPoints + definitions +
   *  connections + tips). 2 = practice half (flashcards + examQuestions).
   *  Undefined = single-pass mode (default for SHORT/MEDIUM/LONG). */
  pass?: 1 | 2;
  /** Per-call abort timeout in milliseconds. Default 25_000 (25s) preserves
   *  shared-budget behavior used by chat + legacy single-step paths. The
   *  per-provider Inngest steps in lib/inngest.ts pass 55_000 since each
   *  provider attempt runs in its own 60s Vercel function invocation. */
  timeoutMs?: number;
}

export type ProviderFn = (text: string, plan: 'FREE' | 'PRO', opts?: ProviderRunOptions) => Promise<ProviderResult>;

export class TransientAIError extends Error {
  readonly code: string;
  readonly status?: number;
  /** Seconds the upstream told us to wait before retrying (from Retry-After
   *  header or Google RetryInfo body). Undefined = no hint was provided. */
  readonly retryAfterSeconds?: number;
  constructor(code: string, message: string, status?: number, retryAfterSeconds?: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class PermanentAIError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const MODEL_IDS: ModelId[] = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'groq-llama-3.3-70b',
  'groq-llama-3.1-8b',
  'openrouter-free',
  'mistral-small',
  'github-gpt-4o-mini',
  'github-llama-3.3-70b',
  'deepseek-v4-flash',
];
