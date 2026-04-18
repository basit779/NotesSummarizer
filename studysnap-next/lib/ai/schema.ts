import type { StudyMaterial } from './types';

export const STUDY_MATERIAL_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
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
          options: { type: 'array', items: { type: 'string' } },
          correct: { type: 'string' },
          explanation: { type: 'string' },
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
    topicConnections: { type: 'array', items: { type: 'string' } },
    studyTips: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'keyPoints', 'definitions', 'examQuestions', 'flashcards'],
} as const;

/** Pass 1 of XL 2-pass: notes half (summary + keyPoints + definitions + connections + tips). */
export const PASS1_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' } },
    definitions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { term: { type: 'string' }, definition: { type: 'string' } },
        required: ['term', 'definition'],
      },
    },
    topicConnections: { type: 'array', items: { type: 'string' } },
    studyTips: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'keyPoints', 'definitions'],
} as const;

/** Pass 2 of XL 2-pass: practice half (flashcards + examQuestions). */
export const PASS2_SCHEMA = {
  type: 'object',
  properties: {
    examQuestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correct: { type: 'string' },
          explanation: { type: 'string' },
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
  required: ['examQuestions', 'flashcards'],
} as const;

export function validateStudyMaterial(obj: unknown): StudyMaterial {
  if (!obj || typeof obj !== 'object') throw new Error('Not an object');
  const o = obj as Record<string, unknown>;
  if (typeof o.summary !== 'string') throw new Error('summary missing');
  if (!Array.isArray(o.keyPoints)) throw new Error('keyPoints missing');
  if (!Array.isArray(o.definitions)) throw new Error('definitions missing');
  if (!Array.isArray(o.examQuestions)) throw new Error('examQuestions missing');
  if (!Array.isArray(o.flashcards)) throw new Error('flashcards missing');
  return {
    title: typeof o.title === 'string' ? o.title : undefined,
    summary: o.summary,
    keyPoints: (o.keyPoints as string[]).filter((x) => typeof x === 'string'),
    definitions: (o.definitions as any[]).filter((d) => d?.term && d?.definition),
    examQuestions: (o.examQuestions as any[])
      .filter((q) => q?.question && (q?.answer || q?.correct))
      .map((q) => {
        const options = Array.isArray(q.options) ? q.options.filter((x: any) => typeof x === 'string') : undefined;
        const correct = typeof q.correct === 'string' ? q.correct : undefined;
        // Derive the plain answer text from options + correct letter if needed
        let answer = typeof q.answer === 'string' ? q.answer : '';
        if (!answer && options && correct) {
          const idx = ['A', 'B', 'C', 'D'].indexOf(correct.toUpperCase().trim().replace(/[).]/g, ''));
          if (idx >= 0 && options[idx]) answer = options[idx].replace(/^[A-D][).]\s*/i, '');
        }
        return {
          question: q.question,
          options,
          correct,
          explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
          answer,
          difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
        };
      }),
    flashcards: (o.flashcards as any[]).filter((f) => f?.front && f?.back),
    topicConnections: Array.isArray(o.topicConnections)
      ? (o.topicConnections as any[]).filter((x) => typeof x === 'string')
      : undefined,
    studyTips: Array.isArray(o.studyTips)
      ? (o.studyTips as any[]).filter((x) => typeof x === 'string')
      : undefined,
  };
}

/** Pass 1 result — StudyMaterial shape with empty flashcards/examQuestions. */
export function validatePass1(obj: unknown): StudyMaterial {
  if (!obj || typeof obj !== 'object') throw new Error('Not an object');
  const o = obj as Record<string, unknown>;
  if (typeof o.summary !== 'string') throw new Error('summary missing');
  if (!Array.isArray(o.keyPoints)) throw new Error('keyPoints missing');
  if (!Array.isArray(o.definitions)) throw new Error('definitions missing');
  return {
    title: typeof o.title === 'string' ? o.title : undefined,
    summary: o.summary,
    keyPoints: (o.keyPoints as unknown[]).filter((x): x is string => typeof x === 'string'),
    definitions: (o.definitions as any[]).filter((d) => d?.term && d?.definition),
    examQuestions: [],
    flashcards: [],
    topicConnections: Array.isArray(o.topicConnections)
      ? (o.topicConnections as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined,
    studyTips: Array.isArray(o.studyTips)
      ? (o.studyTips as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined,
  };
}

/** Pass 2 result — StudyMaterial shape with only flashcards + examQuestions populated. */
export function validatePass2(obj: unknown): StudyMaterial {
  if (!obj || typeof obj !== 'object') throw new Error('Not an object');
  const o = obj as Record<string, unknown>;
  if (!Array.isArray(o.examQuestions)) throw new Error('examQuestions missing');
  if (!Array.isArray(o.flashcards)) throw new Error('flashcards missing');
  return {
    summary: '',
    keyPoints: [],
    definitions: [],
    examQuestions: (o.examQuestions as any[])
      .filter((q) => q?.question && (q?.answer || q?.correct))
      .map((q) => {
        const options = Array.isArray(q.options) ? q.options.filter((x: any) => typeof x === 'string') : undefined;
        const correct = typeof q.correct === 'string' ? q.correct : undefined;
        let answer = typeof q.answer === 'string' ? q.answer : '';
        if (!answer && options && correct) {
          const idx = ['A', 'B', 'C', 'D'].indexOf(correct.toUpperCase().trim().replace(/[).]/g, ''));
          if (idx >= 0 && options[idx]) answer = options[idx].replace(/^[A-D][).]\s*/i, '');
        }
        return {
          question: q.question,
          options,
          correct,
          explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
          answer,
          difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
        };
      }),
    flashcards: (o.flashcards as any[]).filter((f) => f?.front && f?.back),
  };
}
