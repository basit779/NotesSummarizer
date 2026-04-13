import { anthropic } from '../config/anthropic';
import { env } from '../config/env';
import { SYSTEM_PROMPT, buildUserPrompt } from '../utils/prompts';
import { HttpError } from '../utils/httpError';

export interface StudyMaterial {
  summary: string;
  keyPoints: string[];
  definitions: { term: string; definition: string }[];
  examQuestions: { question: string; answer: string; difficulty: 'easy' | 'medium' | 'hard' }[];
  flashcards: { front: string; back: string }[];
}

const TOOL = {
  name: 'emit_study_material',
  description: 'Emit structured study material extracted from the source content.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Exam-focused summary (150-250 words).' },
      keyPoints: { type: 'array', items: { type: 'string' } },
      definitions: {
        type: 'array',
        items: {
          type: 'object',
          properties: { term: { type: 'string' }, definition: { type: 'string' } },
          required: ['term', 'definition'],
        },
      },
      examQuestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          },
          required: ['question', 'answer', 'difficulty'],
        },
      },
      flashcards: {
        type: 'array',
        items: {
          type: 'object',
          properties: { front: { type: 'string' }, back: { type: 'string' } },
          required: ['front', 'back'],
        },
      },
    },
    required: ['summary', 'keyPoints', 'definitions', 'examQuestions', 'flashcards'],
  },
} as const;

const MAX_CHARS = 60000;

export async function analyzeText(
  rawText: string,
  plan: 'FREE' | 'PRO',
): Promise<{ material: StudyMaterial; model: string; tokensUsed: number }> {
  if (!env.anthropicApiKey) {
    throw new HttpError(500, 'AI_NOT_CONFIGURED', 'ANTHROPIC_API_KEY is not set on the server.');
  }
  const trimmed = rawText.length > MAX_CHARS ? rawText.slice(0, MAX_CHARS) : rawText;
  if (trimmed.trim().length < 50) {
    throw new HttpError(400, 'EMPTY_SOURCE', 'The document did not contain enough extractable text.');
  }

  const response = await anthropic.messages.create({
    model: env.anthropicModel,
    max_tokens: plan === 'PRO' ? 4096 : 2048,
    system: SYSTEM_PROMPT,
    tools: [TOOL as any],
    tool_choice: { type: 'tool', name: TOOL.name } as any,
    messages: [{ role: 'user', content: buildUserPrompt(trimmed, plan) }],
  });

  const toolBlock = response.content.find((b: any) => b.type === 'tool_use') as any;
  if (!toolBlock || !toolBlock.input) {
    throw new HttpError(502, 'AI_BAD_RESPONSE', 'AI did not return structured output.');
  }

  const tokens = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  return {
    material: toolBlock.input as StudyMaterial,
    model: response.model,
    tokensUsed: tokens,
  };
}
