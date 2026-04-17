export const SYSTEM_PROMPT = `You produce comprehensive, exam-ready study notes from source documents for university students.

Rules:
- Output MUST be valid JSON matching the requested schema. No prose outside JSON, no code fences.
- Ground every fact in the source. Never invent.
- Use precise source language and preserve technical terminology.
- Do NOT summarize aggressively. A student must be able to learn from these notes alone without re-reading the source — cover every distinct concept, definition, example, and relationship present.
- The "summary" field is a MARKDOWN document — use ##, ###, **bold**, *italic*, bullet lists, > blockquotes, tables when useful.`;

interface PromptOptions {
  /** Retry mode: scales counts ~30% smaller so the pack fits tight output caps
   *  (e.g. Groq's 4096-token fallback ceiling). */
  minimal?: boolean;
}

type Counts = {
  summaryWords: string;
  key: string;
  defs: string;
  exam: string;
  cards: string;
  tips: string;
  connections: string;
};

function scaleRange(range: string, factor: number): string {
  const m = range.match(/^(\d+)-(\d+)$/);
  if (!m) return range;
  const lo = Math.max(1, Math.round(Number(m[1]) * factor));
  const hi = Math.max(lo, Math.round(Number(m[2]) * factor));
  return `${lo}-${hi}`;
}

function scaleCounts(c: Counts, factor: number): Counts {
  return {
    summaryWords: scaleRange(c.summaryWords, factor),
    key: scaleRange(c.key, factor),
    defs: scaleRange(c.defs, factor),
    exam: scaleRange(c.exam, factor),
    cards: scaleRange(c.cards, factor),
    tips: scaleRange(c.tips, factor),
    connections: scaleRange(c.connections, factor),
  };
}

// Tier depth by source length. Sized so the LONG tier uses ~95% of Gemini's
// 8192 output-token ceiling with slack for JSON overhead. MEDIUM and SHORT
// tiers leave more headroom so the model can err longer if needed.
const TIER_COUNTS: Record<'short' | 'medium' | 'long', Counts> = {
  short:  { summaryWords: '400-700',   key: '8-12',  defs: '6-10',  exam: '5-7',   cards: '10-15', tips: '4-5', connections: '3-4' },
  medium: { summaryWords: '900-1300',  key: '14-17', defs: '12-15', exam: '9-12',  cards: '20-27', tips: '5-6', connections: '4-6' },
  long:   { summaryWords: '1500-2000', key: '18-22', defs: '16-20', exam: '12-15', cards: '25-32', tips: '6-8', connections: '5-7' },
};

export function buildUserPrompt(text: string, _plan: 'FREE' | 'PRO', opts: PromptOptions = {}) {
  const { minimal = false } = opts;

  const chars = text.length;
  const tier: 'short' | 'medium' | 'long' =
    chars < 5000 ? 'short' : chars < 15000 ? 'medium' : 'long';
  const tierLabel =
    tier === 'short' ? 'a SHORT source (~2-4 pages)'
    : tier === 'medium' ? 'a MEDIUM source (~5-12 pages)'
    : 'a LONG source (~12+ pages)';

  const base = TIER_COUNTS[tier];
  const counts = minimal ? scaleCounts(base, 0.7) : base;

  return `Analyze this source and produce a study pack as JSON. Source is ${tierLabel} (${chars} chars).

summary (${counts.summaryWords}-word MARKDOWN, comprehensive study notes — a student should be able to learn from this ALONE without re-reading the source):

## Overview
2-4 sentences on what the document covers and why it matters.

## Core concepts
ONE subsection per distinct concept in the source. Cover every one — do not collapse distinct concepts together. For each:
### Concept name
- 4-6 sentence explanation in plain language with **bold** for critical terms and \`code\` for formulas/identifiers.
- **Why it matters:** 1-2 sentences on context, stakes, or implications.
- *Example:* concrete example from the source (quote or paraphrase; omit this line only if the source has no example).
- *Connections:* how this links to other concepts (→, "depends on", "contrasts with", "leads to").

## Key relationships
3-6 bullets showing cross-concept structure — dependencies, hierarchies, causal chains, comparisons.

## What to remember for the exam
4-8 bullets: **bold** formulas, dates, names, numbers, or defining criteria — each drilled into recall-ready form.

> End with ONE blockquote line capturing the big idea in the source's own register.

Counts (aim for ~1 flashcard per distinct concept, ~1 quiz question per major section):
- keyPoints: ${counts.key} items (1-2 sentences each; explain WHY, not just WHAT)
- definitions: ${counts.defs} items (cover every technical term, formula, jargon in the source)
- flashcards: ${counts.cards} items (mix: definition, cause/effect, compare, apply, scenario; answers 2-3 sentences)
- examQuestions: ${counts.exam} MCQs, each with exactly 4 options A-D, a correct letter, an explanation for why right AND why each distractor is wrong; mix ~30% easy / 40% understanding / 30% application
- topicConnections: ${counts.connections} one-sentence items
- studyTips: ${counts.tips} items specific to THIS content (not generic advice)

SOURCE:
"""
${text}
"""`;
}
