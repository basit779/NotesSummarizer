export const SYSTEM_PROMPT = `You produce comprehensive, exam-ready study notes from source documents for university students.

Rules:
- Output MUST be valid JSON matching the requested schema. No prose outside JSON, no code fences.
- Ground every fact in the source. Never invent.
- Use precise source language and preserve technical terminology.
- Do NOT summarize aggressively. A student must be able to learn from these notes alone without re-reading the source — cover every distinct concept, definition, example, and relationship present.
- On LARGE sources (30+ pages), prioritize BREADTH over per-concept depth: it is better to have 30 concepts with 3 tight sentences each than 8 concepts with 5 paragraphs each. Do NOT collapse distinct topics together.
- The "summary" field is a MARKDOWN document — use ##, ###, **bold**, *italic*, bullet lists, > blockquotes, tables when useful.`;

export interface PromptOptions {
  /** Retry mode: scales counts ~30% smaller so the pack fits tight output caps
   *  (e.g. Groq's 4096-token fallback ceiling). */
  minimal?: boolean;
  /** Number of PDF pages (if known). Tier selection uses pages OR chars
   *  whichever lands in the higher tier — slide-heavy PDFs have low char
   *  density but still need broad coverage. */
  pages?: number;
}

export type Tier = 'short' | 'medium' | 'long' | 'xl';

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

/**
 * Tier sizing is bounded by Gemini's 8192 output-token ceiling. XL at upper
 * range will occasionally overflow — the BAD_JSON retry path (minimal=70%)
 * catches that. LONG and below stay comfortably inside the cap.
 *
 * XL intentionally trades summary depth for item count per the system
 * prompt's "breadth > depth on large docs" rule: summary is compressed to
 * 500-700 words while keyPoints/definitions/flashcards/exam all scale up,
 * so a 45-page slide deck gets ~26 keyPoints + ~36 flashcards + ~19 MCQs
 * instead of a long summary with sparse coverage.
 */
const TIER_COUNTS: Record<Tier, Counts> = {
  short:  { summaryWords: '400-700',   key: '8-12',  defs: '6-10',  exam: '5-7',   cards: '10-15', tips: '4-5', connections: '3-4' },
  medium: { summaryWords: '900-1300',  key: '14-17', defs: '12-15', exam: '9-12',  cards: '20-27', tips: '5-6', connections: '4-6' },
  long:   { summaryWords: '1500-2000', key: '18-22', defs: '16-20', exam: '12-15', cards: '25-32', tips: '6-8', connections: '5-7' },
  xl:     { summaryWords: '500-700',   key: '25-28', defs: '20-24', exam: '18-20', cards: '35-38', tips: '4-6', connections: '4-6' },
};

/**
 * Pages OR chars — whichever lands in the higher tier. Slide-heavy PDFs
 * have low char density (sparse text on each slide) but high topic density
 * (one concept per slide), so page count is often the truer signal.
 */
export function selectTier(chars: number, pages: number | undefined): Tier {
  const p = pages ?? 0;
  if (p >= 45 || chars >= 60000) return 'xl';
  if (p >= 30 || chars >= 40000) return 'long';
  if (p >= 15 || chars >= 15000) return 'medium';
  if (p >= 8  || chars >= 5000)  return 'medium'; // slide decks at 8-14 pages still MEDIUM on page signal
  return 'short';
}

export function buildUserPrompt(text: string, _plan: 'FREE' | 'PRO', opts: PromptOptions = {}) {
  const { minimal = false, pages } = opts;

  const chars = text.length;
  const tier = selectTier(chars, pages);
  const tierLabel =
    tier === 'xl'     ? 'an XL source (~30+ pages — prioritize BREADTH)'
    : tier === 'long' ? 'a LONG source (~15-30 pages)'
    : tier === 'medium' ? 'a MEDIUM source (~5-14 pages)'
    : 'a SHORT source (~2-4 pages)';

  const base = TIER_COUNTS[tier];
  const counts = minimal ? scaleCounts(base, 0.7) : base;

  const pageInfo = pages ? `${pages} pages, ${chars} chars` : `${chars} chars`;

  return `Analyze this source and produce a study pack as JSON. Source is ${tierLabel} (${pageInfo}).

summary (${counts.summaryWords}-word MARKDOWN, comprehensive study notes — a student should be able to learn from this ALONE without re-reading the source):

## Overview
2-4 sentences on what the document covers and why it matters.

## Core concepts
ONE subsection per distinct concept in the source. Cover EVERY one — do not collapse distinct concepts together. For XL sources (30+ pages), aim for 20-30+ concept subsections, each tight (3-4 sentences + bullets), rather than 5-8 long ones. For each:
### Concept name
- 3-5 sentence explanation in plain language with **bold** for critical terms and \`code\` for formulas/identifiers.
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

/**
 * XL 2-pass sizing. Conservative vs single-pass XL because the user's
 * 45-page test overflowed at ~8641 tokens with items running ~30% fatter
 * than 4-chars-per-token estimates. Each pass targets ~5K tokens output
 * with headroom to ~6.5K before we'd risk the 8192 cap — so even if items
 * run verbose on the upper bound, we stay safe.
 */
interface Pass1Counts {
  summaryWords: string;
  key: string;
  defs: string;
}
interface Pass2Counts {
  cards: string;
  exam: string;
  tips: string;
  connections: string;
}
const XL_PASS1_COUNTS: Pass1Counts = {
  summaryWords: '400-600',
  key: '22-26',
  defs: '20-24',
};
const XL_PASS2_COUNTS: Pass2Counts = {
  cards: '32-38',
  exam: '16-20',
  tips: '4-6',
  connections: '4-6',
};

function scalePass1(c: Pass1Counts, factor: number): Pass1Counts {
  return {
    summaryWords: scaleRange(c.summaryWords, factor),
    key: scaleRange(c.key, factor),
    defs: scaleRange(c.defs, factor),
  };
}
function scalePass2(c: Pass2Counts, factor: number): Pass2Counts {
  return {
    cards: scaleRange(c.cards, factor),
    exam: scaleRange(c.exam, factor),
    tips: scaleRange(c.tips, factor),
    connections: scaleRange(c.connections, factor),
  };
}

/**
 * XL Pass 1 — core notes. Produces summary + keyPoints + definitions.
 * topicConnections + studyTips were moved to Pass 2 after Mistral pass 1 hit
 * the 7500-token cap with finish=length on a 45-page test — pass 1 carrying
 * 5 sections was too heavy. Splitting 3/4 fits both passes comfortably.
 */
export function buildUserPromptPass1(text: string, opts: { minimal?: boolean; pages?: number } = {}) {
  const { minimal = false, pages } = opts;
  const base = minimal ? scalePass1(XL_PASS1_COUNTS, 0.7) : XL_PASS1_COUNTS;
  const pageInfo = pages ? `${pages} pages, ${text.length} chars` : `${text.length} chars`;

  return `Analyze this source and produce the CORE NOTES HALF of a study pack as JSON. Source is an XL document (${pageInfo}).

This is PASS 1 of 2. A separate pass will generate flashcards, exam questions, topic connections, and study tips from the same source — DO NOT produce those here. Output only the fields requested below.

summary (${base.summaryWords}-word MARKDOWN, comprehensive study notes — a student should be able to learn from this ALONE without re-reading the source):

## Overview
2-4 sentences on what the document covers and why it matters.

## Core concepts
ONE subsection per distinct concept in the source. Cover EVERY one — do not collapse distinct concepts together. For XL sources (30+ pages), aim for 20-30+ concept subsections, each tight (3-4 sentences + bullets), rather than 5-8 long ones. For each:
### Concept name
- 3-5 sentence explanation in plain language with **bold** for critical terms and \`code\` for formulas/identifiers.
- **Why it matters:** 1-2 sentences on context, stakes, or implications.
- *Example:* concrete example from the source (quote or paraphrase; omit this line only if the source has no example).
- *Connections:* how this links to other concepts (→, "depends on", "contrasts with", "leads to").

## Key relationships
3-6 bullets showing cross-concept structure — dependencies, hierarchies, causal chains, comparisons.

## What to remember for the exam
4-8 bullets: **bold** formulas, dates, names, numbers, or defining criteria — each drilled into recall-ready form.

> End with ONE blockquote line capturing the big idea in the source's own register.

Counts:
- keyPoints: ${base.key} items (1-2 sentences each; explain WHY, not just WHAT)
- definitions: ${base.defs} items (cover every technical term, formula, jargon in the source)

DO NOT include flashcards, examQuestions, topicConnections, or studyTips — those are handled by pass 2.

SOURCE:
"""
${text}
"""`;
}

/**
 * XL Pass 2 — practice + secondary sections. Produces flashcards +
 * examQuestions + topicConnections + studyTips. Pass 1 handled core notes
 * (summary/keyPoints/definitions).
 */
export function buildUserPromptPass2(text: string, opts: { minimal?: boolean; pages?: number } = {}) {
  const { minimal = false, pages } = opts;
  const base = minimal ? scalePass2(XL_PASS2_COUNTS, 0.7) : XL_PASS2_COUNTS;
  const pageInfo = pages ? `${pages} pages, ${text.length} chars` : `${text.length} chars`;

  return `Analyze this source and produce the PRACTICE HALF of a study pack as JSON. Source is an XL document (${pageInfo}).

This is PASS 2 of 2. Pass 1 already generated the core notes (summary, keyPoints, definitions). DO NOT reproduce those. Output only flashcards, examQuestions, topicConnections, and studyTips.

Aim for coverage across every distinct topic in the source — roughly 1 flashcard per concept and 1 MCQ per major section.

Counts:
- flashcards: ${base.cards} items (mix: definition, cause/effect, compare, apply, scenario; answers 2-3 sentences)
- examQuestions: ${base.exam} MCQs, each with exactly 4 options A-D, a correct letter, an explanation for why right AND why each distractor is wrong; mix ~30% easy / 40% understanding / 30% application
- topicConnections: ${base.connections} one-sentence items (cross-concept links — dependencies, contrasts, progressions)
- studyTips: ${base.tips} items specific to THIS content (not generic advice)

DO NOT include summary, keyPoints, or definitions — those were handled by pass 1.

SOURCE:
"""
${text}
"""`;
}
