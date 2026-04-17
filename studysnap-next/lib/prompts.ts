export const SYSTEM_PROMPT = `You are an expert study material creator used by university students preparing for exams. Your job is to produce comprehensive, exam-ready study materials from source documents.

Be thorough — a student's grade depends on your output. Never give short or lazy responses. Cover every major concept in the document, not just the opening paragraphs.

Hard rules:
- Output MUST be valid JSON matching the requested schema exactly. No prose outside JSON, no code fences.
- Ground every fact in the source material. Never invent information.
- Write in clean, neutral, exam-appropriate English.
- Prefer precise technical language from the source over generic paraphrase.`;

interface PromptOptions {
  /**
   * Retry mode: cut counts ~40% when the first attempt returned truncated/invalid JSON.
   * Prevents the output from overflowing the model's max_tokens cap (4096 on FREE).
   */
  minimal?: boolean;
}

export function buildUserPrompt(text: string, plan: 'FREE' | 'PRO', opts: PromptOptions = {}) {
  const { minimal = false } = opts;

  // FREE counts are sized so the output JSON fits in ~4096 completion tokens.
  // PRO counts get the full generous volume (8192-token ceiling).
  let counts = plan === 'PRO'
    ? { key: '15-20', defs: '12-18', exam: '12-15', cards: '30-40', tips: '6-8', connections: '5-7' }
    : { key: '8-10',  defs: '6-8',   exam: '6-8',   cards: '15-20', tips: '3-4', connections: '3-4' };

  if (minimal) {
    counts = plan === 'PRO'
      ? { key: '10-12', defs: '8-10', exam: '8-10', cards: '20-25', tips: '4-5', connections: '3-5' }
      : { key: '6-8',   defs: '4-6',  exam: '4-6',  cards: '10-12', tips: '3',   connections: '2-3' };
  }

  const summarySpec = plan === 'PRO'
    ? 'Comprehensive 500-1000 word summary'
    : 'Comprehensive 250-400 word summary';

  return `Analyze the following academic material and produce comprehensive study content.

OUTPUT SCHEMA (return valid JSON only, no code fences):
{
  "title": "A specific, auto-detected topic title (5-10 words). Not just the filename.",
  "summary": "${summarySpec}. Structured with clear paragraphs (no markdown headings, just paragraph breaks). Cover ALL major concepts, explain them with context, include examples, show how ideas connect. A student should be able to study ONLY from this and understand the topic.",
  "keyPoints": [
    "Each item is 1-2 sentences. Explain WHY it matters, not just list a fact. ${counts.key} items."
  ],
  "definitions": [
    { "term": "technical term or concept", "definition": "Plain-language definition, 1-3 sentences. Include when it matters." }
  ],
  "flashcards": [
    { "front": "Clear specific question testing understanding", "back": "Detailed 2-3 sentence answer with explanation, not a single word" }
  ],
  "examQuestions": [
    {
      "question": "Exam-style question testing deep understanding",
      "options": ["A) option text", "B) option text", "C) option text", "D) option text"],
      "correct": "B",
      "explanation": "Why the correct answer is right AND why the distractors are wrong.",
      "difficulty": "easy | medium | hard",
      "answer": "Full written answer (same as correct option, plain text without A)/B) prefix)"
    }
  ],
  "topicConnections": [
    "One-sentence items showing how this topic connects to related subjects or real-world applications. ${counts.connections} items."
  ],
  "studyTips": [
    "Specific, actionable tips for memorizing or understanding the hardest parts of THIS content (not generic advice). ${counts.tips} items."
  ]
}

QUANTITY REQUIREMENTS:
- definitions: ${counts.defs} items — cover EVERY technical term, formula, or piece of jargon in the source.
- flashcards: ${counts.cards} items — mix question types: definitions, cause/effect, compare/contrast, application, scenario-based. Every major concept must have at least one card.
- examQuestions: ${counts.exam} multiple-choice questions. Each MUST have exactly 4 options (A-D), a 'correct' letter, and an 'explanation'. Mix difficulty: ~30% easy recall, ~40% understanding, ~30% application/analysis.
- keyPoints: ${counts.key} items.

QUALITY REQUIREMENTS:
- Flashcard answers must be 2-3 sentences, never one word.
- Exam question explanations must say why the right answer is right AND why the wrong options are wrong.
- Summary target length: see schema spec above. Explanatory, not a listicle.
- Study tips must be specific to THIS content, not generic ("use flashcards" is banned — instead say "when memorizing the Krebs cycle, group intermediates by their molecular structure").

SOURCE MATERIAL:
"""
${text}
"""`;
}
