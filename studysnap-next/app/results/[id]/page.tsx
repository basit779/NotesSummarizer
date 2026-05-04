'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Copy, Download, Lock, Clock, FileText, ArrowLeft, Play, Zap,
  BookOpen, ListOrdered, Library, Layers, HelpCircle, Lightbulb, MessageSquare,
  CheckCircle2, Hash, PanelRightClose, PanelRightOpen,
} from 'lucide-react';
import { api } from '@/lib/client/api';
import { useAuth } from '@/lib/client/auth';
import { Protected } from '@/components/Protected';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { MarkdownView } from '@/components/ui/MarkdownView';
import { Flashcard } from '@/components/Flashcard';
import { Chat } from '@/components/Chat';
import { cn } from '@/lib/utils';
import { MouseGlow } from '@/components/ui/MouseGlow';

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

type TabId = 'notes' | 'key' | 'defs' | 'flash' | 'exam' | 'tips';

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof BookOpen;
  count?: (r: ResultData) => number;
}

const TABS: TabDef[] = [
  { id: 'notes', label: 'Notes',         icon: BookOpen },
  { id: 'key',   label: 'Key points',    icon: ListOrdered, count: (r) => r.keyPoints.length },
  { id: 'defs',  label: 'Definitions',   icon: Library,     count: (r) => r.definitions.length },
  { id: 'flash', label: 'Flashcards',    icon: Layers,      count: (r) => r.flashcards.length },
  { id: 'exam',  label: 'Quiz',          icon: HelpCircle,  count: (r) => r.examQuestions.length },
  { id: 'tips',  label: 'Study tips',    icon: Lightbulb,   count: (r) => (r.studyTips?.length ?? 0) + (r.topicConnections?.length ?? 0) },
];

function QuizQuestion({ q, index }: { q: ExamQ; index: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const options = q.options ?? [];
  const correctLetter = (q.correct ?? '').toUpperCase().trim().replace(/[).]/g, '').charAt(0);
  const diff = q.difficulty.toLowerCase();
  const tone =
    diff === 'easy' ? 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300' :
    diff === 'medium' ? 'border-amber-500/25 bg-amber-500/[0.07] text-amber-300' :
    'border-rose-500/25 bg-rose-500/[0.07] text-rose-300';

  function getLetter(opt: string, i: number) {
    const m = opt.match(/^([A-D])[).]\s*(.*)$/i);
    if (m) return { letter: m[1].toUpperCase(), text: m[2] };
    return { letter: String.fromCharCode(65 + i), text: opt };
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.025] to-transparent p-5 md:p-6 hover:border-white/[0.09] transition-colors">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="mono text-[11px] text-white/40 shrink-0 pt-1">Q{String(index + 1).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1">
              <div className="text-white font-medium leading-relaxed text-[14.5px] md:text-[15px]">{q.question}</div>
            </div>
          </div>
          <span className={cn('mono shrink-0 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider', tone)}>{q.difficulty}</span>
        </div>

        {options.length > 0 ? (
          <div className="space-y-2">
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
                    'w-full text-left rounded-xl border px-4 py-3 text-sm transition-all cursor-pointer flex items-start gap-3',
                    !revealed && 'border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.04] hover:border-white/[0.12] text-white/85',
                    revealed && !showState && 'border-white/[0.04] bg-white/[0.01] text-white/35',
                    showState && isCorrect && 'border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-100',
                    showState && !isCorrect && 'border-rose-500/40 bg-rose-500/[0.08] text-rose-100',
                  )}
                >
                  <span className={cn(
                    'mono text-[11px] shrink-0 flex h-6 w-6 items-center justify-center rounded-md border',
                    !revealed && 'border-white/[0.08] bg-white/[0.02] text-white/50',
                    revealed && !showState && 'border-white/[0.05] bg-white/[0.01] text-white/25',
                    showState && isCorrect && 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200',
                    showState && !isCorrect && 'border-rose-500/50 bg-rose-500/15 text-rose-200',
                  )}>{letter}</span>
                  <span className="pt-0.5 flex-1">{text}</span>
                  {showState && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />}
                </button>
              );
            })}
            <AnimatePresence>
              {revealed && q.explanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl border border-mint-500/20 bg-gradient-to-br from-mint-500/[0.07] to-mint-500/[0.02] p-4 mt-3">
                    <div className="mono text-[11px] text-mint-300 mb-1.5 tracking-wider">EXPLANATION</div>
                    <div className="text-[13.5px] text-white/85 leading-relaxed">{q.explanation}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <details className="group">
            <summary className="mono cursor-pointer list-none inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/60 hover:text-mint-300 hover:border-mint-500/30 transition-colors">
              reveal answer
            </summary>
            <p className="mt-3 text-[14px] text-white/80 leading-relaxed">{q.answer}</p>
            {q.explanation && <p className="mt-2 text-[13px] text-white/60 leading-relaxed"><span className="mono text-[11px] text-mint-300">why: </span>{q.explanation}</p>}
          </details>
        )}
      </div>
    </motion.div>
  );
}

function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-8">
      <div className="space-y-6 animate-pulse">
        <div className="h-4 w-32 rounded bg-white/[0.05]" />
        <div className="h-16 rounded-3xl bg-white/[0.03]" />
        <div className="grid md:grid-cols-[220px_1fr_380px] gap-5 mt-8">
          <div className="h-64 rounded-2xl bg-white/[0.03]" />
          <div className="h-[600px] rounded-3xl bg-white/[0.03]" />
          <div className="h-[600px] rounded-3xl bg-white/[0.03]" />
        </div>
      </div>
    </div>
  );
}

function ResultsInner() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const [result, setResult] = useState<ResultData | null>(null);
  const [tab, setTab] = useState<TabId>('notes');
  const [chatOpen, setChatOpen] = useState(true);

  useEffect(() => {
    api.get(`/results/${id}`).then((d) => setResult(d.result)).catch(() => toast.error('Failed to load result'));
  }, [id]);

  useEffect(() => {
    // On narrow viewports, close chat by default so the notes have full width.
    if (typeof window !== 'undefined' && window.innerWidth < 1280) setChatOpen(false);
  }, []);

  const stats = useMemo(() => {
    if (!result) return null;
    return {
      cards: result.flashcards.length,
      defs: result.definitions.length,
      qs: result.examQuestions.length,
    };
  }, [result]);

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
    <div className="min-h-screen relative overflow-hidden bg-ink-950 font-sans">
      <MouseGlow />
      <div className="absolute top-0 right-1/4 w-[600px] h-[500px] bg-mint-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-6 md:py-8 relative z-10 pt-[100px]">
      {/* Breadcrumb */}
      <Link
        href="/history"
        className="mono text-[11px] text-white/40 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-3 w-3" /> back to history
      </Link>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-3 relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] via-white/[0.015] to-transparent p-5 md:p-7"
      >
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-mint-500/[0.10] blur-3xl" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mint-400/30 to-transparent" aria-hidden />
        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-mint-500/25 bg-gradient-to-b from-mint-500/[0.16] to-mint-500/[0.04] shadow-[0_0_30px_-8px_rgba(16,185,129,0.5)]">
              <FileText className="h-6 w-6 text-mint-400" />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-mint-400 shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mono text-[11px] text-mint-300 tracking-widest">STUDY PACK</div>
              <h1 className="mt-1 mono text-[24px] md:text-[30px] leading-[1.1] font-semibold tracking-tightest text-white break-words">
                {result.title || result.file.filename}
              </h1>
              {result.title && (
                <div className="mt-1 text-[12.5px] text-white/40 truncate flex items-center gap-1.5">
                  <Hash className="h-3 w-3" /> {result.file.filename}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 mono text-[11px] text-white/45">
                <span className="inline-flex items-center gap-1.5"><Clock className="h-3 w-3" />{new Date(result.createdAt).toLocaleString()}</span>
                <span className="text-white/20">·</span>
                <span>{result.file.pageCount ?? '?'} pages</span>
                {stats && (<>
                  <span className="text-white/20">·</span>
                  <span className="text-white/60">{stats.cards} cards</span>
                  <span className="text-white/20">·</span>
                  <span className="text-white/60">{stats.qs} questions</span>
                </>)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => copy(result.summary)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-[13px] text-white/70 hover:text-white hover:border-white/[0.14] hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" /> Copy notes
            </button>
            <Link href={`/study/${result.id}`}>
              <MotionButton size="sm">
                <Play className="h-3.5 w-3.5" /> Study
              </MotionButton>
            </Link>
            <button
              onClick={() => setChatOpen((o) => !o)}
              className="hidden xl:inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-white/70 hover:text-white hover:border-white/[0.14] hover:bg-white/[0.06] transition-all cursor-pointer"
              aria-label={chatOpen ? 'Hide chat' : 'Show chat'}
            >
              {chatOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              {chatOpen ? 'Hide chat' : 'Show chat'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* 3-column workspace: sidebar | notes | chat */}
      <div
        className={cn(
          'mt-5 grid gap-5',
          chatOpen
            ? 'lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_minmax(0,1fr)_400px]'
            : 'lg:grid-cols-[220px_1fr]',
        )}
      >
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start order-2 lg:order-1">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
            <div className="px-3 py-2 mono text-[10px] text-white/40 tracking-widest">CONTENTS</div>
            <nav className="space-y-0.5">
              {TABS.map((t) => {
                const active = t.id === tab;
                const count = t.count ? t.count(result) : undefined;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'group relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-all cursor-pointer',
                      active
                        ? 'text-white bg-white/[0.05]'
                        : 'text-white/55 hover:text-white hover:bg-white/[0.03]',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-mint-400"
                        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      />
                    )}
                    <t.icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-mint-400' : 'text-white/40 group-hover:text-white/70')} />
                    <span className="flex-1 text-left truncate">{t.label}</span>
                    {typeof count === 'number' && count > 0 && (
                      <span className={cn(
                        'mono text-[10px] rounded px-1.5 py-0.5 transition-colors',
                        active ? 'bg-mint-500/15 text-mint-300' : 'bg-white/[0.04] text-white/40',
                      )}>{count}</span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => setChatOpen(true)}
                className="group relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-all cursor-pointer text-white/55 hover:text-white hover:bg-white/[0.03] xl:hidden"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-white/40 group-hover:text-white/70 transition-colors" />
                <span className="flex-1 text-left">Ask AI</span>
              </button>
            </nav>
          </div>

          <div className="mt-3 rounded-2xl border border-white/[0.04] bg-gradient-to-b from-white/[0.015] to-transparent p-4">
            <div className="mono text-[10px] text-mint-400 tracking-widest">PRO TIP</div>
            <div className="mt-1.5 text-[12.5px] text-white/70 leading-relaxed">
              Use <span className="text-white">Flashcards</span> + <span className="text-white">Quiz</span> for active recall — 2× more effective than re-reading.
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 order-1 lg:order-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === 'notes' && (
                <article className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent p-6 md:p-10">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="mono text-[11px] text-mint-400 tracking-widest">// study notes</div>
                      <h2 className="mt-1 mono text-xl font-semibold text-white">Your structured notes.</h2>
                    </div>
                  </div>
                  <MarkdownView content={result.summary} />
                </article>
              )}

              {tab === 'key' && (
                <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent p-6 md:p-10">
                  <div className="mb-6">
                    <div className="mono text-[11px] text-mint-400 tracking-widest">// key points</div>
                    <h2 className="mt-1 mono text-xl font-semibold text-white">What matters most.</h2>
                  </div>
                  <ul className="space-y-3">
                    {result.keyPoints.map((p, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.035, duration: 0.4 }}
                        className="group flex gap-4 rounded-2xl px-3 py-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <span className="mono flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-mint-500/20 bg-gradient-to-b from-mint-500/[0.10] to-mint-500/[0.02] text-[11px] text-mint-300">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[15px] text-white/85 leading-relaxed pt-1">{p}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === 'defs' && (
                <div>
                  <div className="mb-6 px-1">
                    <div className="mono text-[11px] text-mint-400 tracking-widest">// definitions</div>
                    <h2 className="mt-1 mono text-xl font-semibold text-white">Every term, explained.</h2>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {result.definitions.map((d, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.035, duration: 0.45 }}
                        className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-5 hover:border-mint-500/20 hover:from-mint-500/[0.04] transition-all"
                      >
                        <div className="mono text-[10px] text-mint-400/80 tracking-widest">DEF · {String(i + 1).padStart(2, '0')}</div>
                        <div className="mt-2 font-semibold text-white text-[15px] leading-tight">{d.term}</div>
                        <div className="mt-2 text-[13.5px] text-white/60 leading-relaxed">{d.definition}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'flash' && (
                <div>
                  <div className="mb-6 flex items-end justify-between flex-wrap gap-3 px-1">
                    <div>
                      <div className="mono text-[11px] text-mint-400 tracking-widest">// flashcards</div>
                      <h2 className="mt-1 mono text-xl font-semibold text-white">Active recall in seconds.</h2>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/study/${result.id}`}>
                        <MotionButton size="sm">
                          <Play className="h-3.5 w-3.5" /> Study mode
                        </MotionButton>
                      </Link>
                      <MotionButton variant={user?.plan === 'PRO' ? 'primary' : 'outline'} size="sm" onClick={exportFlashcards}>
                        {user?.plan === 'PRO' ? <Download className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                        CSV {user?.plan !== 'PRO' && '· Pro'}
                      </MotionButton>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {result.flashcards.map((f, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 240, damping: 22, delay: i * 0.035 }}
                      >
                        <Flashcard front={f.front} back={f.back} index={i} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'exam' && (
                <div>
                  <div className="mb-6 flex items-end justify-between flex-wrap gap-3 px-1">
                    <div>
                      <div className="mono text-[11px] text-mint-400 tracking-widest">// quiz</div>
                      <h2 className="mt-1 mono text-xl font-semibold text-white">Test what you know.</h2>
                    </div>
                    {result.examQuestions.some((q) => q.options && q.options.length >= 2) && (
                      <Link href={`/quiz/${result.id}`}>
                        <MotionButton size="sm">
                          <Zap className="h-3.5 w-3.5" /> Timed quiz
                        </MotionButton>
                      </Link>
                    )}
                  </div>
                  <div className="space-y-3">
                    {result.examQuestions.map((q, i) => (
                      <QuizQuestion key={i} q={q} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {tab === 'tips' && (
                <div className="space-y-5">
                  <div className="px-1">
                    <div className="mono text-[11px] text-mint-400 tracking-widest">// study tips</div>
                    <h2 className="mt-1 mono text-xl font-semibold text-white">Learn smarter, not harder.</h2>
                  </div>
                  {result.studyTips && result.studyTips.length > 0 && (
                    <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent p-6 md:p-8">
                      <div className="mono text-[11px] text-mint-400 mb-4 tracking-widest">// tactics for THIS content</div>
                      <ul className="space-y-3">
                        {result.studyTips.map((t, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="flex gap-3 text-[14.5px] text-white/80 leading-relaxed"
                          >
                            <span className="mono text-mint-400 shrink-0">▸</span>
                            <span>{t}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.topicConnections && result.topicConnections.length > 0 && (
                    <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent p-6 md:p-8">
                      <div className="mono text-[11px] text-mint-400 mb-4 tracking-widest">// how this connects</div>
                      <ul className="space-y-3">
                        {result.topicConnections.map((t, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="flex gap-3 text-[14.5px] text-white/80 leading-relaxed"
                          >
                            <span className="mono text-mint-400 shrink-0">◇</span>
                            <span>{t}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
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
        </main>

        {/* Chat — sticky side panel on xl+, full-width slide-in below xl */}
        {chatOpen && (
          <>
            <aside className="hidden xl:block xl:sticky xl:top-24 xl:self-start order-3">
              <Chat resultId={result.id} title={result.title || result.file.filename} />
            </aside>

            {/* mobile/tablet drawer */}
            <AnimatePresence>
              <motion.div
                key="chat-mobile-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="xl:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={() => setChatOpen(false)}
              />
              <motion.div
                key="chat-mobile-panel"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                className="xl:hidden fixed inset-y-0 right-0 z-50 w-full sm:max-w-md p-3"
              >
                <div className="h-full relative">
                  <button
                    onClick={() => setChatOpen(false)}
                    className="absolute -top-2 -left-2 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-ink-950 text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                    aria-label="Close chat"
                  >
                    <PanelRightClose className="h-4 w-4" />
                  </button>
                  <Chat resultId={result.id} title={result.title || result.file.filename} />
                </div>
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {/* Floating "Ask AI" button when chat closed on mobile/tablet */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="xl:hidden fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-mint-500 hover:bg-mint-400 text-ink-950 px-4 py-3 shadow-[0_8px_30px_rgba(16,185,129,0.45)] cursor-pointer transition-colors"
            aria-label="Open AI chat"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm font-medium">Ask AI</span>
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return <Protected><ResultsInner /></Protected>;
}
