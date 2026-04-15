'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Copy, Download, Lock, Clock, FileText, ArrowLeft, Play, Zap } from 'lucide-react';
import { api } from '@/lib/client/api';
import { useAuth } from '@/lib/client/auth';
import { Protected } from '@/components/Protected';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { Flashcard } from '@/components/Flashcard';
import { Chat } from '@/components/Chat';
import { cn } from '@/lib/utils';

interface ExamQ {
  question: string;
  answer: string;
  difficulty: string;
  options?: string[];
  correct?: string;
  explanation?: string;
}

interface ResultData {
  id: string;
  title?: string;
  summary: string;
  keyPoints: string[];
  definitions: { term: string; definition: string }[];
  examQuestions: ExamQ[];
  flashcards: { front: string; back: string }[];
  topicConnections?: string[];
  studyTips?: string[];
  file: { filename: string; pageCount: number | null };
  createdAt: string;
}

type TabId = 'summary' | 'key' | 'defs' | 'flash' | 'exam' | 'tips' | 'chat';
const TABS: { id: TabId; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'key', label: 'Key points' },
  { id: 'defs', label: 'Definitions' },
  { id: 'flash', label: 'Flashcards' },
  { id: 'exam', label: 'Quiz' },
  { id: 'tips', label: 'Tips' },
  { id: 'chat', label: 'Ask AI' },
];

function QuizQuestion({ q, index }: { q: ExamQ; index: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const options = q.options ?? [];
  const correctLetter = (q.correct ?? '').toUpperCase().trim().replace(/[).]/g, '').charAt(0);
  const diff = q.difficulty.toLowerCase();
  const tone =
    diff === 'easy' ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300' :
    diff === 'medium' ? 'border-amber-500/20 bg-amber-500/[0.06] text-amber-300' :
    'border-rose-500/20 bg-rose-500/[0.06] text-rose-300';

  function getLetter(opt: string, i: number) {
    const m = opt.match(/^([A-D])[).]\s*(.*)$/i);
    if (m) return { letter: m[1].toUpperCase(), text: m[2] };
    return { letter: String.fromCharCode(65 + i), text: opt };
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <GlassCard>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex gap-3 flex-1 min-w-0">
            <span className="mono text-[11px] text-white/40 shrink-0">Q{String(index + 1).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1">
              <div className="text-white font-medium leading-relaxed">{q.question}</div>
            </div>
          </div>
          <span className={cn('mono shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase', tone)}>{q.difficulty}</span>
        </div>

        {options.length > 0 ? (
          <div className="ml-9 space-y-2">
            {options.map((opt, i) => {
              const { letter, text } = getLetter(opt, i);
              const isSelected = selected === letter;
              const isCorrect = letter === correctLetter;
              const showState = revealed && (isSelected || isCorrect);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setSelected(letter); setRevealed(true); }}
                  disabled={revealed}
                  className={cn(
                    'w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors cursor-pointer',
                    !revealed && 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] text-white/80',
                    revealed && !showState && 'border-white/[0.06] bg-white/[0.02] text-white/40',
                    showState && isCorrect && 'border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-200',
                    showState && !isCorrect && 'border-rose-500/40 bg-rose-500/[0.08] text-rose-200',
                  )}
                >
                  <span className="mono text-[11px] text-white/40 mr-2">{letter}</span>
                  {text}
                </button>
              );
            })}
            <AnimatePresence>
              {revealed && q.explanation && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg border border-mint-500/20 bg-mint-500/[0.05] p-3 mt-3">
                  <div className="mono text-[11px] text-mint-300 mb-1.5">EXPLANATION</div>
                  <div className="text-sm text-white/80 leading-relaxed">{q.explanation}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <details className="group ml-9">
            <summary className="mono cursor-pointer list-none inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-white/60 hover:text-mint-400 hover:border-mint-500/30 transition-colors">
              show answer
            </summary>
            <p className="mt-3 text-sm text-white/70 leading-relaxed">{q.answer}</p>
            {q.explanation && <p className="mt-2 text-sm text-white/60 leading-relaxed"><span className="mono text-[11px] text-mint-300">why: </span>{q.explanation}</p>}
          </details>
        )}
      </GlassCard>
    </motion.div>
  );
}

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
            <h1 className="mono text-2xl md:text-3xl font-semibold tracking-tightest text-white truncate">
              {result.title || result.file.filename}
            </h1>
            {result.title && (
              <div className="mt-1 text-xs text-white/40 truncate">{result.file.filename}</div>
            )}
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
                <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                  <Link href={`/study/${result.id}`}>
                    <MotionButton size="sm">
                      <Play className="h-3.5 w-3.5" /> Start study mode
                    </MotionButton>
                  </Link>
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
              <div>
                {result.examQuestions.some((q) => q.options && q.options.length >= 2) && (
                  <div className="flex justify-end mb-4">
                    <Link href={`/quiz/${result.id}`}>
                      <MotionButton size="sm">
                        <Zap className="h-3.5 w-3.5" /> Start quiz mode
                      </MotionButton>
                    </Link>
                  </div>
                )}
                <div className="space-y-3">
                  {result.examQuestions.map((q, i) => (
                    <QuizQuestion key={i} q={q} index={i} />
                  ))}
                </div>
              </div>
            )}

            {tab === 'tips' && (
              <div className="space-y-6">
                {result.studyTips && result.studyTips.length > 0 && (
                  <GlassCard>
                    <div className="mono text-xs text-mint-400 mb-4">// study tips</div>
                    <ul className="space-y-3">
                      {result.studyTips.map((t, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex gap-3 text-sm text-white/80 leading-relaxed"
                        >
                          <span className="mono text-mint-400 shrink-0">▸</span>
                          <span>{t}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </GlassCard>
                )}
                {result.topicConnections && result.topicConnections.length > 0 && (
                  <GlassCard>
                    <div className="mono text-xs text-mint-400 mb-4">// connections</div>
                    <ul className="space-y-3">
                      {result.topicConnections.map((t, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex gap-3 text-sm text-white/80 leading-relaxed"
                        >
                          <span className="mono text-mint-400 shrink-0">◇</span>
                          <span>{t}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </GlassCard>
                )}
                {!result.studyTips?.length && !result.topicConnections?.length && (
                  <GlassCard className="text-center !py-14">
                    <div className="mono text-xs text-white/40">no study tips for this pack</div>
                  </GlassCard>
                )}
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
