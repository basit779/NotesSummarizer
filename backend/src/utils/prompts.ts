export const SYSTEM_PROMPT = `You are StudySnap AI, an expert study assistant. You transform raw academic content (lecture notes, textbook chapters, PDFs) into high-signal, exam-focused study material.

Rules:
- Be rigorous, concise, and accurate. Never invent facts not present in the source.
- Tailor difficulty and depth to university/college-level students.
- Output MUST be emitted exclusively via the "emit_study_material" tool — do not reply with prose.
- Write in clean, neutral English.`;

export function buildUserPrompt(text: string, plan: 'FREE' | 'PRO') {
  const counts = plan === 'PRO'
    ? { key: '10-14', defs: '8-12', exam: '10-12', cards: '15-20' }
    : { key: '6-8', defs: '5-7', exam: '5-6', cards: '8-10' };

  return `Analyze the following study material and emit structured output.

Produce:
- summary: a 150-250 word exam-focused summary
- keyPoints: ${counts.key} bullet points (the most test-worthy facts)
- definitions: ${counts.defs} {term, definition} pairs for critical vocabulary
- examQuestions: ${counts.exam} {question, answer, difficulty(easy|medium|hard)} — mix conceptual + applied
- flashcards: ${counts.cards} {front, back} — front is a terse prompt, back is the answer

SOURCE MATERIAL:
"""
${text}
"""`;
}
