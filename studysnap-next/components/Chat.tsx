'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2, User, Zap, Clock } from 'lucide-react';
import { api } from '@/lib/client/api';
import { cn } from '@/lib/utils';
import { TypewriterText } from '@/components/ui/TypewriterText';
import { useCooldown } from '@/lib/client/useCooldown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** client-side flag: this message just arrived, play streaming animation */
  justArrived?: boolean;
}

const SUGGESTIONS = [
  { icon: Sparkles, label: 'One-sentence summary',      prompt: 'Summarize this in one sentence.' },
  { icon: Zap,      label: 'Quick 3-question quiz',      prompt: 'Quiz me with 3 questions.' },
  { icon: Sparkles, label: 'Simplify the hardest part',  prompt: 'Explain the hardest concept simply.' },
  { icon: Zap,      label: 'What should I focus on?',    prompt: 'What should I focus on for an exam?' },
];

export function Chat({ resultId, title }: { resultId: string; title?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cooldown = useCooldown();

  useEffect(() => {
    api.get(`/chat/${resultId}`)
      .then((d) => setMessages(d.messages ?? []))
      .finally(() => setInitialLoading(false));
  }, [resultId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(160, el.scrollHeight);
    el.style.height = `${next}px`;
  }, [input]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading || cooldown.active) return;
    setInput('');
    setLoading(true);
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: 'user', content, createdAt: new Date().toISOString() }]);
    try {
      const data = await api.post(`/chat/${resultId}`, { message: content });
      setMessages((m) =>
        m.filter((msg) => msg.id !== tempId).concat([
          data.userMessage,
          { ...data.assistantMessage, justArrived: true },
        ]),
      );
    } catch (err: any) {
      const retryAfter = err?.details?.retryAfterSeconds as number | undefined;
      if (err?.code === 'COOLDOWN_ACTIVE' && retryAfter) {
        cooldown.start(retryAfter);
      } else if (err?.code === 'ALL_RATE_LIMITED') {
        cooldown.start(60);
      }
      setMessages((m) => m.filter((msg) => msg.id !== tempId).concat([{
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: err?.message ?? 'Something went wrong',
        createdAt: new Date().toISOString(),
        justArrived: true,
      }]));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[520px] rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.025] to-white/[0.01] backdrop-blur-xl overflow-hidden shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-mint-500/10 border border-mint-500/25">
            <Sparkles className="h-4 w-4 text-mint-400" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-mint-400 shadow-[0_0_8px_2px_rgba(16,185,129,0.8)]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white leading-tight truncate">Ask about this pack</div>
            <div className="mono text-[10.5px] text-white/40 truncate">{title ?? 'grounded in your notes'}</div>
          </div>
        </div>
        <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 mono text-[10px] text-white/50">
          <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
          gemini · llama fallback
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-5 scroll-smooth">
        {initialLoading ? (
          <div className="flex justify-center items-center h-full text-white/30 mono text-xs">loading…</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-8">
            <div className="relative">
              <div className="absolute inset-0 bg-mint-500/[0.2] blur-2xl rounded-full" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-mint-500/25 bg-gradient-to-b from-mint-500/[0.12] to-mint-500/[0.04]">
                <Sparkles className="h-6 w-6 text-mint-400" />
              </div>
            </div>
            <div>
              <div className="mono text-xs text-mint-400">// ask anything</div>
              <h3 className="mt-2 mono text-xl font-semibold text-white">Your private study tutor.</h3>
              <p className="mt-1.5 text-sm text-white/50 max-w-sm mx-auto">Grounded in the PDF you uploaded — no hallucinations, no fluff.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i }}
                  onClick={() => send(s.prompt)}
                  className="group text-left rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-mint-500/25 transition-all px-4 py-3 cursor-pointer"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mint-500/[0.08] border border-mint-500/15 group-hover:bg-mint-500/[0.14] transition-colors">
                      <s.icon className="h-3.5 w-3.5 text-mint-400" />
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-white/90 leading-tight">{s.label}</div>
                      <div className="mt-0.5 text-[11.5px] text-white/40">{s.prompt}</div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </AnimatePresence>
        )}
        {loading && <TypingDots />}
      </div>

      {/* Pill input */}
      <div className="px-4 md:px-6 pb-5 pt-2">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="group relative flex items-end gap-2 rounded-[22px] border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 focus-within:border-mint-500/40 focus-within:bg-white/[0.06] transition-colors shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about this pack…"
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 pt-1.5 pb-1 text-[14.5px] leading-relaxed text-white placeholder:text-white/30 focus:outline-none max-h-40"
            disabled={loading}
          />
          <motion.button
            type="submit"
            disabled={!input.trim() || loading || cooldown.active}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'flex h-9 shrink-0 items-center justify-center rounded-xl transition-all cursor-pointer px-2',
              cooldown.active ? 'w-auto min-w-[3rem] bg-white/[0.05] text-white/60' :
              input.trim() && !loading
                ? 'w-9 bg-mint-500 text-ink-950 shadow-[0_0_20px_rgba(16,185,129,0.45)] hover:bg-mint-400'
                : 'w-9 bg-white/[0.05] text-white/30 cursor-not-allowed',
            )}
            aria-label={cooldown.active ? `Wait ${cooldown.secondsLeft} seconds` : 'Send'}
          >
            {cooldown.active ? (
              <span className="inline-flex items-center gap-1 mono text-[11px]">
                <Clock className="h-3.5 w-3.5" />
                {cooldown.secondsLeft}s
              </span>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </motion.button>
        </form>
        <div className="mt-2 text-center mono text-[10px] text-white/25">
          enter to send · shift+enter for new line
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] mono',
          isUser
            ? 'bg-white/[0.06] border border-white/[0.08] text-white/70'
            : 'bg-mint-500/[0.12] border border-mint-500/25 text-mint-400',
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div className={cn('max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed',
            isUser
              ? 'bg-mint-500/[0.10] border border-mint-500/20 text-white rounded-tr-md'
              : 'bg-white/[0.035] border border-white/[0.05] text-white/85 rounded-tl-md',
          )}
        >
          {message.role === 'assistant' && message.justArrived ? (
            <TypewriterText text={message.content} />
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mint-500/[0.12] border border-mint-500/25">
        <Loader2 className="h-3.5 w-3.5 text-mint-400 animate-spin" />
      </div>
      <div className="rounded-2xl rounded-tl-md bg-white/[0.035] border border-white/[0.05] px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-1.5 w-1.5 rounded-full bg-white/40"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}
