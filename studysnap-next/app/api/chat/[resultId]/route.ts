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

  const packContext = JSON.stringify({
    source: result.file.filename,
    summary: result.summary,
    keyPoints: result.keyPoints,
    definitions: result.definitions,
    examQuestions: result.examQuestions,
    flashcards: result.flashcards,
  });

  const systemPrompt = `You are a helpful study tutor. The user has a study pack from "${result.file.filename}". Answer their questions strictly using the study pack below as the source of truth. If the answer isn't in the pack, say so and give your best general guidance.

STUDY PACK:
${packContext}`;

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
