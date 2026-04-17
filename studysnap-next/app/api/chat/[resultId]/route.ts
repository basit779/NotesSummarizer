import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';
import { chatComplete } from '@/lib/ai/chat';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const GET = withErrorHandling(async (req: Request, ctx: { params: Promise<{ resultId: string }> }) => {
  const user = await requireAuth(req);
  const { resultId } = await ctx.params;
  const result = await prisma.processingResult.findUnique({ where: { id: resultId }, select: { userId: true } });
  if (!result || result.userId !== user.id) throw new HttpError(404, 'NOT_FOUND', 'Not found');
  const messages = await prisma.chatMessage.findMany({
    where: { resultId },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  return NextResponse.json({ messages });
});

export const POST = withErrorHandling(async (req: Request, ctx: { params: Promise<{ resultId: string }> }) => {
  const user = await requireAuth(req);
  const { resultId } = await ctx.params;
  const body = await req.json();
  const userMessage = String(body?.message ?? '').slice(0, 2000).trim();
  if (!userMessage) throw new HttpError(400, 'EMPTY', 'Message is empty');

  const result = await prisma.processingResult.findUnique({
    where: { id: resultId },
    include: { file: { select: { filename: true } } },
  });
  if (!result || result.userId !== user.id) throw new HttpError(404, 'NOT_FOUND', 'Not found');

  // Build context: study pack + last 10 messages
  const prior = await prisma.chatMessage.findMany({
    where: { resultId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { role: true, content: true },
  });
  prior.reverse();

  // Compact natural-language context. Raw JSON dump would burn ~5-10k tokens
  // per chat turn with no quality gain. Key points + definitions + summary
  // cover 95% of grounded Q&A needs; flashcards/quiz lists are redundant.
  const keyPointsBlock = (result.keyPoints as string[])
    .slice(0, 20)
    .map((p, i) => `${i + 1}. ${p}`)
    .join('\n');
  const defsBlock = (result.definitions as Array<{ term: string; definition: string }>)
    .slice(0, 20)
    .map((d) => `- **${d.term}**: ${d.definition}`)
    .join('\n');

  // Cap summary at ~4k chars inside the system prompt; the full markdown
  // notes are displayed client-side anyway.
  const summarySnippet = (result.summary as string).slice(0, 4000);

  const systemPrompt = `You are a helpful study tutor. The user is studying from "${result.file.filename}". Answer strictly using the notes below as source of truth. If the answer isn't covered, say so clearly and then give your best general guidance. Keep answers concise (2-4 paragraphs max) and use markdown when structure helps.

=== STUDY NOTES ===
${summarySnippet}

=== KEY POINTS ===
${keyPointsBlock}

=== DEFINITIONS ===
${defsBlock}
=== END CONTEXT ===`;

  const aiMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...prior.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  // Save the user message first so it shows even if AI fails
  const savedUser = await prisma.chatMessage.create({
    data: { resultId, userId: user.id, role: 'user', content: userMessage },
  });

  const { content: assistantContent, model } = await chatComplete(aiMessages);

  const savedAssistant = await prisma.chatMessage.create({
    data: { resultId, userId: user.id, role: 'assistant', content: assistantContent },
  });

  return NextResponse.json({
    userMessage: savedUser,
    assistantMessage: savedAssistant,
    model,
  });
});
