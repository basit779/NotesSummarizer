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

/** Pass 1 of XL 2-pass: core notes (summary + keyPoints + definitions). */
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
  },
  required: ['summary', 'keyPoints', 'definitions'],
} as const;

/** Pass 2 of XL 2-pass: practice + secondary sections
 *  (flashcards + examQuestions + topicConnections + studyTips). */
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
    topicConnections: { type: 'array', items: { type: 'string' } },
    studyTips: { type: 'array', items: { type: 'string' } },
  },
  required: ['examQuestions', 'flashcards'],
} as const;

/** Extract the answer letter (A/B/C/D) from common `correct` field formats:
 *  "A", "A.", "A)", "(A)", "Option A", "A) The cat", "correct answer is B".
 *  Looks for the first A-D character that's preceded by start-of-string OR
 *  punctuation/whitespace AND followed by end-of-string OR same — that
 *  filters out incidental letters inside words ("CORRECT" → no false C
 *  match). Returns '' if no plausible letter is found. */
function extractCorrectLetter(raw: string | null | undefined): string {
  if (!raw) return '';
  const m = raw.toUpperCase().match(/(?:^|[\s().,:;-])([A-D])(?=$|[\s().,:;-])/);
  return m ? m[1] : '';
}

/**
 * Validate + apply a minimum quality bar to the model's output. Items that
 * fail the bar are dropped silently (with a console.warn) rather than
 * throwing — a sparse-but-clean pack beats a fail-and-fallback cascade
 * that costs another provider call. Below-threshold counts also log but
 * do NOT throw: degrade gracefully.
 *
 * `modelId` is optional and only used for log labelling so we can tell
 * which provider produced low-quality output.
 */
export function validateStudyMaterial(obj: unknown, modelId?: string): StudyMaterial {
  if (!obj || typeof obj !== 'object') throw new Error('Not an object');
  const o = obj as Record<string, unknown>;
  if (typeof o.summary !== 'string') throw new Error('summary missing');
  if (!Array.isArray(o.keyPoints)) throw new Error('keyPoints missing');
  if (!Array.isArray(o.definitions)) throw new Error('definitions missing');
  if (!Array.isArray(o.examQuestions)) throw new Error('examQuestions missing');
  if (!Array.isArray(o.flashcards)) throw new Error('flashcards missing');

  const modelLabel = modelId ? ` [${modelId}]` : '';
  const logFiltered = (kind: string, original: number, kept: number) => {
    if (kept !== original) {
      // eslint-disable-next-line no-console
      console.warn(`[schema]${modelLabel} ${kind}: ${kept}/${original} survived quality bar`);
    }
  };

  // Definitions: term ≥ 2 chars, definition ≥ 20 chars.
  const rawDefs = (o.definitions as any[]).filter((d) => d?.term && d?.definition);
  const definitions = rawDefs.filter(
    (d) =>
      typeof d.term === 'string' &&
      d.term.length >= 2 &&
      typeof d.definition === 'string' &&
      d.definition.length >= 20,
  );
  logFiltered('definitions', rawDefs.length, definitions.length);

  // Exam questions: shape-check first (existing logic), then quality bar:
  // exactly 4 options, correct ∈ {A,B,C,D}, explanation ≥ 10 chars.
  const mappedExam = (o.examQuestions as any[])
    .filter((q) => q?.question && (q?.answer || q?.correct))
    .map((q) => {
      const options = Array.isArray(q.options) ? q.options.filter((x: any) => typeof x === 'string') : undefined;
      const correct = typeof q.correct === 'string' ? q.correct : undefined;
      // Derive the plain answer text from options + correct letter if needed
      let answer = typeof q.answer === 'string' ? q.answer : '';
      if (!answer && options && correct) {
        const idx = ['A', 'B', 'C', 'D'].indexOf(extractCorrectLetter(correct));
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
    });
  // Diagnostic capture: record the FIRST MCQ that gets filtered + which check
  // killed it. One sample is enough to diagnose systematic format mismatches
  // (e.g. model returning correct="(A)" instead of "A") without log-spamming.
  let firstMcqFilterReason: string | null = null;
  const examQuestions = mappedExam.filter((q) => {
    if (!q.options || q.options.length !== 4) {
      if (!firstMcqFilterReason) {
        firstMcqFilterReason = `options.length=${q.options?.length ?? 'missing'} (need 4) | sample: ${JSON.stringify({ question: String(q.question).slice(0, 80), options: q.options }).slice(0, 240)}`;
      }
      return false;
    }
    const normCorrect = extractCorrectLetter(q.correct);
    if (!['A', 'B', 'C', 'D'].includes(normCorrect)) {
      if (!firstMcqFilterReason) {
        firstMcqFilterReason = `correct=${JSON.stringify(q.correct)} normalized="${normCorrect}" (need A/B/C/D) | sample: ${JSON.stringify({ question: String(q.question).slice(0, 60), correct: q.correct, options: q.options }).slice(0, 280)}`;
      }
      return false;
    }
    if (!q.explanation || q.explanation.length < 10) {
      if (!firstMcqFilterReason) {
        firstMcqFilterReason = `explanation.length=${q.explanation?.length ?? 0} (need ≥10) | sample: ${JSON.stringify({ question: String(q.question).slice(0, 80), explanation: q.explanation }).slice(0, 240)}`;
      }
      return false;
    }
    return true;
  });
  logFiltered('examQuestions', mappedExam.length, examQuestions.length);
  if (firstMcqFilterReason) {
    // eslint-disable-next-line no-console
    console.warn(`[schema]${modelLabel} examQuestions first-filter: ${firstMcqFilterReason}`);
  }
  if (examQuestions.length < 3) {
    // eslint-disable-next-line no-console
    console.warn(`[schema]${modelLabel} examQuestions: only ${examQuestions.length} after quality bar — pack will be sparse`);
  }

  // Flashcards: front ≥ 10, back ≥ 40, and reject trivial "What is X?" /
  // "X is Y" definition cards. The system prompt already bans these but
  // we enforce it here as a backstop for non-Gemini providers without
  // schema-side enforcement.
  let firstCardFilterReason: string | null = null;
  const rawCards = (o.flashcards as any[]).filter((f) => f?.front && f?.back);
  const flashcards = rawCards.filter((f) => {
    const front: string = typeof f.front === 'string' ? f.front : '';
    const back: string = typeof f.back === 'string' ? f.back : '';
    if (front.length < 10) {
      if (!firstCardFilterReason) firstCardFilterReason = `front.length=${front.length} (need ≥10) | front="${front.slice(0, 80)}"`;
      return false;
    }
    if (back.length < 40) {
      if (!firstCardFilterReason) firstCardFilterReason = `back.length=${back.length} (need ≥40) | front="${front.slice(0, 60)}" back="${back.slice(0, 80)}"`;
      return false;
    }
    if (front.startsWith('What is ') && back.slice(0, 30).includes(' is ')) {
      if (!firstCardFilterReason) firstCardFilterReason = `trivial "What is X?/X is Y" pair | front="${front.slice(0, 60)}" back="${back.slice(0, 60)}"`;
      return false;
    }
    return true;
  });
  logFiltered('flashcards', rawCards.length, flashcards.length);
  if (firstCardFilterReason) {
    // eslint-disable-next-line no-console
    console.warn(`[schema]${modelLabel} flashcards first-filter: ${firstCardFilterReason}`);
  }
  if (flashcards.length < 5) {
    // eslint-disable-next-line no-console
    console.warn(`[schema]${modelLabel} flashcards: only ${flashcards.length} after quality bar — pack will be sparse`);
  }

  return {
    title: typeof o.title === 'string' ? o.title : undefined,
    summary: o.summary,
    keyPoints: (o.keyPoints as string[]).filter((x) => typeof x === 'string'),
    definitions,
    examQuestions,
    flashcards,
    topicConnections: Array.isArray(o.topicConnections)
      ? (o.topicConnections as any[]).filter((x) => typeof x === 'string')
      : undefined,
    studyTips: Array.isArray(o.studyTips)
      ? (o.studyTips as any[]).filter((x) => typeof x === 'string')
      : undefined,
  };
}

/** Pass 1 result — StudyMaterial shape with core notes only
 *  (flashcards/examQuestions/topicConnections/studyTips live in pass 2).
 *  Definition quality bar mirrors validateStudyMaterial. */
export function validatePass1(obj: unknown, modelId?: string): StudyMaterial {
  if (!obj || typeof obj !== 'object') throw new Error('Not an object');
  const o = obj as Record<string, unknown>;
  if (typeof o.summary !== 'string') throw new Error('summary missing');
  if (!Array.isArray(o.keyPoints)) throw new Error('keyPoints missing');
  if (!Array.isArray(o.definitions)) throw new Error('definitions missing');

  const modelLabel = modelId ? ` [${modelId}]` : '';
  const logFiltered = (kind: string, original: number, kept: number) => {
    if (kept !== original) {
      // eslint-disable-next-line no-console
      console.warn(`[schema]${modelLabel} ${kind}: ${kept}/${original} survived quality bar`);
    }
  };

  // Definitions: term ≥ 2 chars, definition ≥ 20 chars.
  const rawDefs = (o.definitions as any[]).filter((d) => d?.term && d?.definition);
  const definitions = rawDefs.filter(
    (d) =>
      typeof d.term === 'string' &&
      d.term.length >= 2 &&
      typeof d.definition === 'string' &&
      d.definition.length >= 20,
  );
  logFiltered('definitions', rawDefs.length, definitions.length);

  return {
    title: typeof o.title === 'string' ? o.title : undefined,
    summary: o.summary,
    keyPoints: (o.keyPoints as unknown[]).filter((x): x is string => typeof x === 'string'),
    definitions,
    examQuestions: [],
    flashcards: [],
  };
}

/** Pass 2 result — practice + secondary sections (flashcards, examQuestions,
 *  topicConnections, studyTips). Pass 1 holds summary/keyPoints/definitions.
 *  Flashcard + MCQ quality bar mirrors validateStudyMaterial. */
export function validatePass2(obj: unknown, modelId?: string): StudyMaterial {
  if (!obj || typeof obj !== 'object') throw new Error('Not an object');
  const o = obj as Record<string, unknown>;
  if (!Array.isArray(o.examQuestions)) throw new Error('examQuestions missing');
  if (!Array.isArray(o.flashcards)) throw new Error('flashcards missing');

  const modelLabel = modelId ? ` [${modelId}]` : '';
  const logFiltered = (kind: string, original: number, kept: number) => {
    if (kept !== original) {
      // eslint-disable-next-line no-console
      console.warn(`[schema]${modelLabel} ${kind}: ${kept}/${original} survived quality bar`);
    }
  };

  // Exam questions: shape-check first, then quality bar — exactly 4 options,
  // correct ∈ {A,B,C,D}, explanation ≥ 10 chars.
  const mappedExam = (o.examQuestions as any[])
    .filter((q) => q?.question && (q?.answer || q?.correct))
    .map((q) => {
      const options = Array.isArray(q.options) ? q.options.filter((x: any) => typeof x === 'string') : undefined;
      const correct = typeof q.correct === 'string' ? q.correct : undefined;
      let answer = typeof q.answer === 'string' ? q.answer : '';
      if (!answer && options && correct) {
        const idx = ['A', 'B', 'C', 'D'].indexOf(extractCorrectLetter(correct));
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
    });
  // Diagnostic capture (mirrors validateStudyMaterial — see comment there).
  let firstMcqFilterReason: string | null = null;
  const examQuestions = mappedExam.filter((q) => {
    if (!q.options || q.options.length !== 4) {
      if (!firstMcqFilterReason) {
        firstMcqFilterReason = `options.length=${q.options?.length ?? 'missing'} (need 4) | sample: ${JSON.stringify({ question: String(q.question).slice(0, 80), options: q.options }).slice(0, 240)}`;
      }
      return false;
    }
    const normCorrect = extractCorrectLetter(q.correct);
    if (!['A', 'B', 'C', 'D'].includes(normCorrect)) {
      if (!firstMcqFilterReason) {
        firstMcqFilterReason = `correct=${JSON.stringify(q.correct)} normalized="${normCorrect}" (need A/B/C/D) | sample: ${JSON.stringify({ question: String(q.question).slice(0, 60), correct: q.correct, options: q.options }).slice(0, 280)}`;
      }
      return false;
    }
    if (!q.explanation || q.explanation.length < 10) {
      if (!firstMcqFilterReason) {
        firstMcqFilterReason = `explanation.length=${q.explanation?.length ?? 0} (need ≥10) | sample: ${JSON.stringify({ question: String(q.question).slice(0, 80), explanation: q.explanation }).slice(0, 240)}`;
      }
      return false;
    }
    return true;
  });
  logFiltered('examQuestions', mappedExam.length, examQuestions.length);
  if (firstMcqFilterReason) {
    // eslint-disable-next-line no-console
    console.warn(`[schema]${modelLabel} examQuestions first-filter: ${firstMcqFilterReason}`);
  }
  if (examQuestions.length < 3) {
    // eslint-disable-next-line no-console
    console.warn(`[schema]${modelLabel} examQuestions: only ${examQuestions.length} after quality bar — pack will be sparse`);
  }

  // Flashcards: front ≥ 10, back ≥ 40, reject trivial "What is X?" / "X is Y" pairs.
  let firstCardFilterReason: string | null = null;
  const rawCards = (o.flashcards as any[]).filter((f) => f?.front && f?.back);
  const flashcards = rawCards.filter((f) => {
    const front: string = typeof f.front === 'string' ? f.front : '';
    const back: string = typeof f.back === 'string' ? f.back : '';
    if (front.length < 10) {
      if (!firstCardFilterReason) firstCardFilterReason = `front.length=${front.length} (need ≥10) | front="${front.slice(0, 80)}"`;
      return false;
    }
    if (back.length < 40) {
      if (!firstCardFilterReason) firstCardFilterReason = `back.length=${back.length} (need ≥40) | front="${front.slice(0, 60)}" back="${back.slice(0, 80)}"`;
      return false;
    }
    if (front.startsWith('What is ') && back.slice(0, 30).includes(' is ')) {
      if (!firstCardFilterReason) firstCardFilterReason = `trivial "What is X?/X is Y" pair | front="${front.slice(0, 60)}" back="${back.slice(0, 60)}"`;
      return false;
    }
    return true;
  });
  logFiltered('flashcards', rawCards.length, flashcards.length);
  if (firstCardFilterReason) {
    // eslint-disable-next-line no-console
    console.warn(`[schema]${modelLabel} flashcards first-filter: ${firstCardFilterReason}`);
  }
  if (flashcards.length < 5) {
    // eslint-disable-next-line no-console
    console.warn(`[schema]${modelLabel} flashcards: only ${flashcards.length} after quality bar — pack will be sparse`);
  }

  return {
    summary: '',
    keyPoints: [],
    definitions: [],
    examQuestions,
    flashcards,
    topicConnections: Array.isArray(o.topicConnections)
      ? (o.topicConnections as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined,
    studyTips: Array.isArray(o.studyTips)
      ? (o.studyTips as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined,
  };
}
