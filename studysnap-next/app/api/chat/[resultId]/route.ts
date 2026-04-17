import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, withErrorHandling } from '@/lib/apiHelpers';
import { HttpError } from '@/lib/httpError';
import { chatComplete } from '@/lib/ai/chat';
import { enforceChatCooldown } from '@/lib/rateLimit';
import { cacheGet, cacheSet, hashKey } from '@/lib/ai/cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CHAT_COOLDOWN_SECONDS = 3;

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

  // Per-user chat cooldown — prevents spam-click double-sends.
  await enforceChatCooldown({ userId: user.id, cooldownSeconds: CHAT_COOLDOWN_SECONDS });

  const result = await prisma.processingResult.findUnique({
    where: { id: resultId },
    include: { file: { select: { filename: true } } },
  });
  if (!result || result.userId !== user.id) throw new HttpError(404, 'NOT_FOUND', 'Not found');

  // Session control: keep the last N turns verbatim. If history goes beyond
  // that, collapse older messages into a single [summary] system-note message
  // so the model has continuity without us shipping all of it every call.
  const RECENT_TURNS = 8;
  const priorAll = await prisma.chatMessage.findMany({
    where: { resultId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { role: true, content: true, createdAt: true },
  });
  priorAll.reverse();

  const recent = priorAll.slice(-RECENT_TURNS);
  const older = priorAll.slice(0, Math.max(0, priorAll.length - RECENT_TURNS));
  const olderSummaryNote = older.length > 0
    ? older.map((m) => `- ${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 120)}${m.content.length > 120 ? '…' : ''}`).join('\n')
    : '';
  const prior = recent;

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

  const systemPrompt = `You are a helpful study tutor. The user is studying from "${result.file.filename}". Answer strictly using the notes below. If the answer isn't covered, say so clearly then give your best general guidance.

LENGTH (strict):
- Simple definitional questions ("what is X?", "define Y"): answer in 1-2 sentences.
- Complex or multi-part questions: at most 3 short paragraphs.
- No preamble ("Great question!"), no recap at the end, no padding.

FORMATTING (use markdown sparingly):
- **bold** for key terms only.
- Bullets ONLY when listing 3+ distinct items.
- No headers (no #, ##, ###) in chat responses.
- No code blocks unless the question is about code.

=== NOTES ===
${summarySnippet}

=== KEY POINTS ===
${keyPointsBlock}

=== DEFINITIONS ===
${defsBlock}${olderSummaryNote ? `\n\n=== EARLIER CONVERSATION (condensed) ===\n${olderSummaryNote}` : ''}
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

  let assistantContent: string;
  let model: string;
  let degraded = false;
  let cached = false;

  // Prompt-hash cache: same question against the same pack = served from memory
  // (no AI call). Keyed by resultId + user message; pack context is already
  // derived from resultId so it's implicitly part of the key.
  const cacheKey = hashKey('chat-v1', resultId, userMessage.toLowerCase().trim());
  const cachedHit = cacheGet<{ content: string; model: string }>(cacheKey);

  if (cachedHit) {
    assistantContent = cachedHit.content;
    model = cachedHit.model;
    cached = true;
    console.log(`[CHAT] ${user.id} cache hit — 0 AI calls`);
  } else try {
    const out = await chatComplete(aiMessages);
    assistantContent = out.content;
    model = out.model;
    cacheSet(cacheKey, { content: assistantContent, model });
  } catch (err: any) {
    // Graceful degradation: store a polite assistant message rather than a
    // hard error, so the user's chat history stays consistent and they
    // always get visible feedback. Client can still read the degraded flag.
    degraded = true;
    model = 'fallback-static';
    if (err?.code === 'ALL_RATE_LIMITED') {
      assistantContent = "I'm temporarily rate-limited across all free providers. Give it about a minute and ask again — your question is saved.";
    } else if (err?.code === 'NO_AI_PROVIDER') {
      assistantContent = 'The AI service is not configured right now. Please try again later.';
    } else {
      assistantContent = "I couldn't reach the AI just now. Try asking again in a moment.";
    }
    console.log(`[CHAT] ${user.id} degraded response — ${err?.code ?? 'UNKNOWN'}: ${err?.message ?? err}`);
  }

  const savedAssistant = await prisma.chatMessage.create({
    data: { resultId, userId: user.id, role: 'assistant', content: assistantContent },
  });

  return NextResponse.json({
    userMessage: savedUser,
    assistantMessage: savedAssistant,
    model,
    degraded,
    cached,
  });
});
