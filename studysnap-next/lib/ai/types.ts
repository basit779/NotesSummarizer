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
  /** Multi-pass signal. Undefined = single-pass mode (the default).
   *
   *  Legacy 2-way split (XL 2-pass system, still valid):
   *    1 = core notes (summary + keyPoints + definitions)
   *    2 = practice half (flashcards + examQuestions + connections + tips)
   *
   *  3-way split (DeepSeek parallel orchestration in lib/inngest.ts —
   *  passes 1, 3 and 4 run simultaneously as separate Inngest steps):
   *    3 = flashcards ONLY
   *    4 = examQuestions + topicConnections + studyTips
   *  Splitting pass 2's payload across passes 3+4 halves each call's output
   *  so DeepSeek's 50-80 tok/s can generate FULL-quality counts inside the
   *  50s per-step timeout, instead of ultra-trimmed counts in one fat pass. */
  pass?: 1 | 2 | 3 | 4;
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
