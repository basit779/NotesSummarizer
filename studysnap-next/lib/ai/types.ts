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
  | 'gemini-2.0-flash'
  | 'groq-llama-3.3-70b'
  | 'groq-llama-3.1-8b'
  | 'openrouter-deepseek'
  | 'mistral-small'
  | 'github-gpt-4o-mini'
  | 'github-llama-3.3-70b';

export interface ProviderResult {
  material: StudyMaterial;
  model: string;
  tokensUsed: number;
}

export interface ProviderRunOptions {
  /** Retry mode: use a trimmed prompt so output fits in the model's max_tokens cap. */
  minimal?: boolean;
  /** Number of PDF pages (if known). Used by the prompt builder for tier
   *  selection — slide-heavy PDFs need page signal, not just char count. */
  pages?: number;
}

export type ProviderFn = (text: string, plan: 'FREE' | 'PRO', opts?: ProviderRunOptions) => Promise<ProviderResult>;

export class TransientAIError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
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
  'gemini-2.0-flash',
  'groq-llama-3.3-70b',
  'groq-llama-3.1-8b',
  'openrouter-deepseek',
  'mistral-small',
  'github-gpt-4o-mini',
  'github-llama-3.3-70b',
];
