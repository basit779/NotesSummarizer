export const SYSTEM_PROMPT = `You produce exam-ready study materials from source documents for university students.

Rules:
- Output MUST be valid JSON matching the requested schema. No prose outside JSON, no code fences.
- Ground every fact in the source. Never invent.
- Use precise source language.
- The "summary" field is a MARKDOWN document — use ##, ###, **bold**, *italic*, bullet lists, > blockquotes, tables when useful.`;

interface PromptOptions {
  /** Retry mode: ~40% smaller counts so output fits tight output caps. */
  minimal?: boolean;
}

export function buildUserPrompt(text: string, plan: 'FREE' | 'PRO', opts: PromptOptions = {}) {
  const { minimal = false } = opts;

  // Generous volumes for both plans. Gemini 2.0 Flash free tier supports 8192
  // output tokens — FREE users get real packs, not truncated summaries.
  let counts = plan === 'PRO'
    ? { key: '15-20', defs: '14-20', exam: '12-15', cards: '30-40', tips: '6-8', connections: '5-7' }
    : { key: '12-15', defs: '10-14', exam: '10-12', cards: '22-30', tips: '5-6', connections: '4-5' };

  if (minimal) {
    counts = plan === 'PRO'
      ? { key: '10-12', defs: '8-10',  exam: '8-10',  cards: '20-25', tips: '4-5', connections: '3-5' }
      : { key: '8-10',  defs: '6-8',   exam: '6-8',   cards: '15-20', tips: '3-4', connections: '3-4' };
  }

  const wordTarget = plan === 'PRO' ? '900-1400' : '600-1000';

  // Compact single-block prompt — previously we had ~1500 tokens of schema
  // instructions; this tighter version is ~600 tokens and produces equally
  // structured output thanks to the enforced responseSchema.
  return `Analyze this source and produce a study pack as JSON.

summary (${wordTarget}-word markdown):
## Overview
2-4 plain-language sentences on what this covers and why.

## Core concepts
For each major concept (4-8 total):
### Concept name
3-5 sentence explanation using **bold** for critical terms and \`code\` for formulas/identifiers.
- 3-5 bullet sub-points (facts, properties)
- *Example:* concrete example
- markdown table when comparing variants

## Key relationships
2-4 bullets showing how concepts connect (use →, "leads to", "depends on").

## What to remember for the exam
3-5 bullets with **bold** numbers/dates/formulas/names to memorize verbatim.

> End with ONE blockquote line capturing the big idea.

Counts:
- keyPoints: ${counts.key} items (1-2 sentences each; explain WHY, not just WHAT)
- definitions: ${counts.defs} items (cover every technical term, formula, jargon)
- flashcards: ${counts.cards} items (mix: definition, cause/effect, compare, apply, scenario; answers 2-3 sentences)
- examQuestions: ${counts.exam} MCQs, each with exactly 4 options A-D, a correct letter, explanation for why right AND why distractors wrong; mix ~30% easy / 40% understanding / 30% application
- topicConnections: ${counts.connections} one-sentence items
- studyTips: ${counts.tips} items specific to THIS content (not generic advice)

SOURCE:
"""
${text}
"""`;
}
