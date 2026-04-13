export interface StudyMaterial {
  summary: string;
  keyPoints: string[];
  definitions: { term: string; definition: string }[];
  examQuestions: { question: string; answer: string; difficulty: 'easy' | 'medium' | 'hard' }[];
  flashcards: { front: string; back: string }[];
}

export type ModelId =
  | 'gemini-2.5-pro'
  | 'gemini-2.0-flash'
  | 'groq-llama-3.3-70b'
  | 'groq-llama-3.1-8b'
  | 'openrouter-deepseek'
  | 'mistral-small';

export interface ProviderResult {
  material: StudyMaterial;
  model: string;
  tokensUsed: number;
}

export interface Plan {
  plan: 'FREE' | 'PRO';
}

export type ProviderFn = (text: string, plan: 'FREE' | 'PRO') => Promise<ProviderResult>;

/**
 * Transient error — caller should try next fallback model.
 * Use for: rate limits, missing API keys, 5xx, network errors, malformed JSON.
 */
export class TransientAIError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Permanent error — stop fallback chain (e.g. input too short).
 */
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
];
