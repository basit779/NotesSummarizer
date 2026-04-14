'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { api } from '@/lib/client/api';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

const SUGGESTIONS = [
  'Summarize this in one sentence',
  'Quiz me with 3 questions',
  'Explain the hardest concept simply',
  'What should I focus on for an exam?',
];

export function Chat({ resultId }: { resultId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get(`/chat/${resultId}`)
      .then((d) => setMessages(d.messages ?? []))
      .finally(() => setInitialLoading(false));
  }, [resultId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setInput('');
    setLoading(true);
    // optimistic user message
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: 'user', content, createdAt: new Date().toISOString() }]);
    try {
      const data = await api.post(`/chat/${resultId}`, { message: content });
      setMessages((m) =>
        m.filter((msg) => msg.id !== tempId).concat([data.userMessage, data.assistantMessage]),
      );
    } catch (err: any) {
      setMessages((m) => m.filter((msg) => msg.id !== tempId));
      setMessages((m) => [...m, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠ ${err?.message ?? 'Something went wrong'}`,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[600px] rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.05]">
        <Sparkles className="h-4 w-4 text-mint-400" />
        <span className="mono text-xs text-white/60">ASK ABOUT THIS PACK</span>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {initialLoading ? (
          <div className="flex justify-center items-center h-full text-white/30 mono text-xs">loading…</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <div className="mono text-xs text-white/40">Ask anything about the source material.</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-mint-500/30 transition-colors px-3 py-2.5 text-sm text-white/70 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-mint-500/[0.12] border border-mint-500/20 text-white'
                      : 'bg-white/[0.04] border border-white/[0.06] text-white/85',
                  )}
                >
                  {m.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] text-white/60 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> <span className="mono text-xs">thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2 px-3 py-3 border-t border-white/[0.05] bg-white/[0.02]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something about the pack…"
          className="flex-1 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-mint-500/50 focus:bg-white/[0.05] transition-colors"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-500 text-ink-950 hover:bg-mint-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
