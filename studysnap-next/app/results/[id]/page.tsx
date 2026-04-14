'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Copy, Download, Lock, Clock, FileText, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/client/api';
import { useAuth } from '@/lib/client/auth';
import { Protected } from '@/components/Protected';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { Flashcard } from '@/components/Flashcard';
import { Chat } from '@/components/Chat';
import { cn } from '@/lib/utils';

interface ResultData {
  id: string;
  summary: string;
  keyPoints: string[];
  definitions: { term: string; definition: string }[];
  examQuestions: { question: string; answer: string; difficulty: string }[];
  flashcards: { front: string; back: string }[];
  file: { filename: string; pageCount: number | null };
  createdAt: string;
}

type TabId = 'summary' | 'key' | 'defs' | 'flash' | 'exam' | 'chat';
const TABS: { id: TabId; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'key', label: 'Key points' },
  { id: 'defs', label: 'Definitions' },
  { id: 'flash', label: 'Flashcards' },
  { id: 'exam', label: 'Exam questions' },
  { id: 'chat', label: 'Ask AI' },
];

function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="space-y-4">
        <div className="h-6 w-40 rounded bg-white/[0.05] animate-pulse" />
        <div className="h-10 w-80 rounded bg-white/[0.05] animate-pulse" />
        <div className="h-64 rounded-2xl bg-white/[0.03] animate-pulse mt-8" />
      </div>
    </div>
  );
}

function ResultsInner() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const [result, setResult] = useState<ResultData | null>(null);
  const [tab, setTab] = useState<TabId>('summary');

  useEffect(() => {
    api.get(`/results/${id}`).then((d) => setResult(d.result)).catch(() => toast.error('Failed to load result'));
  }, [id]);

  if (!result) return <Loading />;

  function copy(text: string) { navigator.clipboard.writeText(text); toast.success('Copied'); }

  function exportFlashcards() {
    if (user?.plan !== 'PRO') { toast.error('Flashcard export is a Pro feature'); return; }
    const csv = ['Front,Back', ...result!.flashcards.map((f) =>
      `"${f.front.replace(/"/g, '""')}","${f.back.replace(/"/g, '""')}"`,
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result!.file.filename}-flashcards.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Link href="/history" className="mono text-xs text-white/40 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer">
          <ArrowLeft className="h-3 w-3" /> back to history
        </Link>
        <div className="mt-4 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-mint-500/20 bg-mint-500/[0.06]">
            <FileText className="h-5 w-5 text-mint-400" />
          </div>
          <div className="min-w-0">
            <h1 className="mono text-2xl md:text-3xl font-semibold tracking-tightest text-white truncate">{result.file.filename}</h1>
            <div className="mt-1.5 flex items-center gap-3 mono text-[11px] text-white/40">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(result.createdAt).toLocaleString()}</span>
              <span className="text-white/20">·</span>
              <span>{result.file.pageCount ?? '?'} pages</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-8 -mx-2 overflow-x-auto">
        <div className="inline-flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 mx-2">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  'relative whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-colors cursor-pointer',
                  active ? 'text-white' : 'text-white/50 hover:text-white/80',
                )}
              >
                {active && (
                  <motion.div
                    layoutId="tab-active"
                    className="absolute inset-0 rounded-lg bg-white/[0.06] border border-white/[0.08]"
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}>
            {tab === 'summary' && (
              <GlassCard className="!p-8">
                <div className="flex justify-between items-start mb-4">
                  <div className="mono text-xs text-white/50">// summary</div>
                  <button
                    onClick={() => copy(result.summary)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/[0.14] transition-colors cursor-pointer"
                  ><Copy className="h-3 w-3" /> Copy</button>
                </div>
                <div className="prose prose-invert max-w-none text-white/80 leading-relaxed whitespace-pre-wrap">{result.summary}</div>
              </GlassCard>
            )}

            {tab === 'key' && (
              <GlassCard className="!p-8">
                <ul className="space-y-4">
                  {result.keyPoints.map((p, i) => (
                    <motion.li
                      key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      className="flex gap-4"
                    >
                      <span className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-mint-500/20 bg-mint-500/[0.06] text-[11px] text-mint-300">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-white/85 leading-relaxed pt-0.5">{p}</span>
                    </motion.li>
                  ))}
                </ul>
              </GlassCard>
            )}

            {tab === 'defs' && (
              <div className="grid gap-3 md:grid-cols-2">
                {result.definitions.map((d, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <GlassCard glow className="h-full">
                      <div className="mono text-[11px] text-mint-400">DEFINITION · {String(i + 1).padStart(2, '0')}</div>
                      <div className="mt-2 font-semibold text-white">{d.term}</div>
                      <div className="mt-2 text-sm text-white/60 leading-relaxed">{d.definition}</div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            )}

            {tab === 'flash' && (
              <div>
                <div className="flex justify-end mb-4">
                  <MotionButton variant={user?.plan === 'PRO' ? 'primary' : 'outline'} size="sm" onClick={exportFlashcards}>
                    {user?.plan === 'PRO' ? <Download className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    Export CSV {user?.plan !== 'PRO' && '· Pro'}
                  </MotionButton>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {result.flashcards.map((f, i) => (
                    <motion.div
                      key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 240, damping: 22, delay: i * 0.04 }}
                    >
                      <Flashcard front={f.front} back={f.back} index={i} />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'chat' && (
              <Chat resultId={result.id} />
            )}

            {tab === 'exam' && (
              <div className="space-y-3">
                {result.examQuestions.map((q, i) => {
                  const diff = q.difficulty.toLowerCase();
                  const tone =
                    diff === 'easy' ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300' :
                    diff === 'medium' ? 'border-amber-500/20 bg-amber-500/[0.06] text-amber-300' :
                    'border-rose-500/20 bg-rose-500/[0.06] text-rose-300';
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <GlassCard>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-3 flex-1 min-w-0">
                            <span className="mono text-[11px] text-white/40 shrink-0">Q{String(i + 1).padStart(2, '0')}</span>
                            <div className="min-w-0">
                              <div className="text-white font-medium leading-relaxed">{q.question}</div>
                              <details className="group mt-3">
                                <summary className="mono cursor-pointer list-none inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-white/60 hover:text-mint-400 hover:border-mint-500/30 transition-colors">
                                  show answer
                                </summary>
                                <p className="mt-3 text-sm text-white/70 leading-relaxed">{q.answer}</p>
                              </details>
                            </div>
                          </div>
                          <span className={cn('mono shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase', tone)}>
                            {q.difficulty}
                          </span>
                        </div>
                      </GlassCard>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return <Protected><ResultsInner /></Protected>;
}
