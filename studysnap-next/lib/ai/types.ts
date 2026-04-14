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
  | 'mistral-small'
  | 'github-gpt-4o-mini'
  | 'github-llama-3.3-70b';

export interface ProviderResult {
  material: StudyMaterial;
  model: string;
  tokensUsed: number;
}

export type ProviderFn = (text: string, plan: 'FREE' | 'PRO') => Promise<ProviderResult>;

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
