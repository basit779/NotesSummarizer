export const SYSTEM_PROMPT = `You are an expert study material creator used by university students preparing for exams. Your job is to produce comprehensive, exam-ready study materials from source documents.

Be thorough — a student's grade depends on your output. Never give short or lazy responses. Cover every major concept in the document, not just the opening paragraphs.

Hard rules:
- Output MUST be valid JSON matching the requested schema exactly. No prose outside JSON, no code fences.
- Ground every fact in the source material. Never invent information.
- Write in clean, neutral, exam-appropriate English.
- Prefer precise technical language from the source over generic paraphrase.
- The "summary" field is a MARKDOWN document — use real markdown syntax (##, ###, **bold**, *italic*, bullet lists, numbered lists, > quotes, \`inline code\`, tables when useful).`;

interface PromptOptions {
  /**
   * Retry mode: cut counts ~40% when the first attempt returned truncated/invalid JSON.
   * Also used for providers with tiny total context windows.
   */
  minimal?: boolean;
}

export function buildUserPrompt(text: string, plan: 'FREE' | 'PRO', opts: PromptOptions = {}) {
  const { minimal = false } = opts;

  // Generous volumes for BOTH plans. Gemini 2.0 Flash supports 8192 output
  // tokens on the free tier, so FREE users get real study packs.
  let counts = plan === 'PRO'
    ? { key: '15-20', defs: '14-20', exam: '12-15', cards: '30-40', tips: '6-8', connections: '5-7' }
    : { key: '12-15', defs: '10-14', exam: '10-12', cards: '22-30', tips: '5-6', connections: '4-5' };

  if (minimal) {
    // Retry / tiny-context-provider mode: ~40% smaller to fit tight output caps.
    counts = plan === 'PRO'
      ? { key: '10-12', defs: '8-10',  exam: '8-10',  cards: '20-25', tips: '4-5', connections: '3-5' }
      : { key: '8-10',  defs: '6-8',   exam: '6-8',   cards: '15-20', tips: '3-4', connections: '3-4' };
  }

  const wordTarget = plan === 'PRO' ? '900-1400' : '600-1000';

  return `Analyze the following academic material and produce comprehensive study content.

OUTPUT SCHEMA (return valid JSON only, no code fences):
{
  "title": "A specific, auto-detected topic title (5-10 words). Not just the filename.",
  "summary": "FULL MARKDOWN STUDY NOTES, ${wordTarget} words. See detailed structure below.",
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

===== "summary" field FORMAT — this is the most important field =====
The summary MUST be structured MARKDOWN study notes (${wordTarget} words), NOT a prose paragraph.
Use actual markdown syntax that will render with headings, bullet lists, blockquotes, and bold terms.

Required structure:

## Overview
A 2-4 sentence plain-language opener explaining what this material covers and why it matters.

## Core concepts
For each major concept (aim for 4-8 concepts total, depending on document size):

### [Concept name]
Explain the concept in 3-5 sentences of flowing prose. Use **bold** for critical terms and \`code style\` for formulas or technical identifiers. Then support with:
- A bullet list of 3-5 sub-points, facts, or properties
- A concrete example (introduced with "*Example:*")
- Where useful, a markdown table comparing variants/types

## Key relationships
A section of 2-4 short bullets explaining how the concepts connect to each other. Use arrows (→) or words like "leads to", "depends on" to make causality clear.

## What to remember for the exam
A final 3-5 bullet list of the single most testable takeaways. Bold the numbers, dates, formulas, or names that students need to memorize verbatim.

> End with one blockquote line: a single "big idea" sentence that captures the essence of the whole topic.

===== END summary field format =====

QUANTITY REQUIREMENTS:
- definitions: ${counts.defs} items — cover EVERY technical term, formula, or piece of jargon in the source.
- flashcards: ${counts.cards} items — mix question types: definitions, cause/effect, compare/contrast, application, scenario-based. Every major concept must have at least one card.
- examQuestions: ${counts.exam} multiple-choice questions. Each MUST have exactly 4 options (A-D), a 'correct' letter, and an 'explanation'. Mix difficulty: ~30% easy recall, ~40% understanding, ~30% application/analysis.
- keyPoints: ${counts.key} items.

QUALITY REQUIREMENTS:
- Flashcard answers must be 2-3 sentences, never one word.
- Exam question explanations must say why the right answer is right AND why the wrong options are wrong.
- Study tips must be specific to THIS content, not generic ("use flashcards" is banned — instead say "when memorizing the Krebs cycle, group intermediates by their molecular structure").
- Summary is MARKDOWN. Use headings (##, ###), real bullet lists (- or *), **bold**, *italic*, and blockquote (>) syntax. Do NOT write one giant paragraph.

SOURCE MATERIAL:
"""
${text}
"""`;
}
