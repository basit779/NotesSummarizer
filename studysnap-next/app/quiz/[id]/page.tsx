'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, RotateCcw, Clock } from 'lucide-react';
import { api } from '@/lib/client/api';
import { Protected } from '@/components/Protected';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { cn } from '@/lib/utils';

interface ExamQ {
  question: string;
  answer: string;
  difficulty: string;
  options?: string[];
  correct?: string;
  explanation?: string;
}

function parseLetter(opt: string, i: number): { letter: string; text: string } {
  const m = opt.match(/^([A-D])[).]\s*(.*)$/i);
  if (m) return { letter: m[1].toUpperCase(), text: m[2] };
  return { letter: String.fromCharCode(65 + i), text: opt };
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function QuizInner() {
  const { id } = useParams<{ id: string }>();
  const [questions, setQuestions] = useState<ExamQ[]>([]);
  const [cursor, setCursor] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState('Quiz');

  useEffect(() => {
    api.get(`/results/${id}`).then((d) => {
      const qs = (d.result.examQuestions as ExamQ[]).filter((q) => q.options && q.options.length >= 2 && q.correct);
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(null));
      setTitle(d.result.title || d.result.file.filename);
      setStartTime(Date.now());
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (finished || loading) return;
    const id = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(id);
  }, [finished, loading, startTime]);

  const current = questions[cursor];
  const total = questions.length;
  const progress = total > 0 ? ((cursor) / total) * 100 : 0;

  const correctLetter = current ? (current.correct ?? '').toUpperCase().trim().replace(/[).]/g, '').charAt(0) : '';

  const pick = useCallback((letter: string) => {
    if (revealed) return;
    setAnswers((prev) => {
      const copy = [...prev];
      copy[cursor] = letter;
      return copy;
    });
    setRevealed(true);
  }, [cursor, revealed]);

  const advance = useCallback(() => {
    if (cursor + 1 >= total) {
      setFinished(true);
    } else {
      setCursor(cursor + 1);
      setRevealed(false);
    }
  }, [cursor, total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (finished) return;
      if (!revealed && ['1', '2', '3', '4', 'a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
        const letter = e.key.toUpperCase().match(/[1-4]/) ? String.fromCharCode(64 + Number(e.key)) : e.key.toUpperCase();
        pick(letter);
      } else if (revealed && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        advance();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, advance, revealed, finished]);

  const correctCount = useMemo(() => {
    return answers.reduce((n, a, i) => {
      const q = questions[i];
      if (!q || !a) return n;
      const c = (q.correct ?? '').toUpperCase().trim().replace(/[).]/g, '').charAt(0);
      return n + (a === c ? 1 : 0);
    }, 0);
  }, [answers, questions]);

  function retryWrong() {
    const wrongIdx = answers.map((a, i) => {
      const q = questions[i];
      if (!q) return -1;
      const c = (q.correct ?? '').toUpperCase().trim().replace(/[).]/g, '').charAt(0);
      return a !== c ? i : -1;
    }).filter((i) => i >= 0);
    if (!wrongIdx.length) return;
    const newQs = wrongIdx.map((i) => questions[i]);
    setQuestions(newQs);
    setAnswers(new Array(newQs.length).fill(null));
    setCursor(0);
    setRevealed(false);
    setFinished(false);
    setStartTime(Date.now());
    setElapsed(0);
  }

  function restart() {
    setAnswers(new Array(questions.length).fill(null));
    setCursor(0);
    setRevealed(false);
    setFinished(false);
    setStartTime(Date.now());
    setElapsed(0);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[80vh] mono text-sm text-white/40">loading quiz…</div>;
  }
  if (!questions.length) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <div className="mono text-xs text-white/40">this pack doesn't have multiple-choice questions yet</div>
        <Link href={`/results/${id}`} className="mt-6 inline-block">
          <MotionButton variant="outline">Back to results</MotionButton>
        </Link>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((correctCount / total) * 100);
    const wrongCount = total - correctCount;
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
          <GlassCard className="text-center !py-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-mint-500/30 bg-mint-500/[0.08]">
              <Trophy className="h-6 w-6 text-mint-400" />
            </div>
            <h2 className="mt-5 mono text-2xl font-semibold text-white">Quiz complete</h2>
            <div className="mt-6 mono text-6xl font-semibold text-mint-400">{pct}%</div>
            <p className="mt-1 text-sm text-white/55">
              {correctCount} / {total} correct · <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(elapsed)}</span>
            </p>

            <div className="mx-auto mt-8 max-w-sm flex flex-col gap-2">
              {wrongCount > 0 && (
                <MotionButton onClick={retryWrong}>
                  <RotateCcw className="h-4 w-4" /> Retry {wrongCount} wrong
                </MotionButton>
              )}
              <MotionButton variant="outline" onClick={restart}>
                Start over
              </MotionButton>
              <Link href={`/results/${id}`}>
                <MotionButton variant="ghost" className="w-full">Back to results</MotionButton>
              </Link>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  const pickedLetter = answers[cursor];

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 md:py-10">
      <div className="flex items-center justify-between mb-6">
        <Link href={`/results/${id}`} className="mono text-xs text-white/40 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer">
          <ArrowLeft className="h-3 w-3" /> exit
        </Link>
        <div className="mono text-xs text-white/50">{cursor + 1} / {total}</div>
        <div className="mono text-xs text-white/50 inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(elapsed)}</div>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06] mb-8">
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="h-full bg-mint-500"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={cursor}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassCard className="!p-8 md:!p-10">
            <div className="mono text-[11px] text-mint-400 mb-4">QUESTION {String(cursor + 1).padStart(2, '0')}</div>
            <h2 className="text-xl md:text-2xl text-white font-medium leading-relaxed">{current.question}</h2>

            <div className="mt-8 space-y-2.5">
              {(current.options ?? []).map((opt, i) => {
                const { letter, text } = parseLetter(opt, i);
                const isPicked = pickedLetter === letter;
                const isCorrect = letter === correctLetter;
                const showCorrect = revealed && isCorrect;
                const showWrong = revealed && isPicked && !isCorrect;
                return (
                  <motion.button
                    key={i}
                    onClick={() => pick(letter)}
                    disabled={revealed}
                    whileTap={{ scale: revealed ? 1 : 0.98 }}
                    className={cn(
                      'w-full text-left rounded-xl border px-4 py-3.5 text-sm md:text-base transition-colors cursor-pointer',
                      !revealed && 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] text-white/85',
                      revealed && !showCorrect && !showWrong && 'border-white/[0.06] bg-white/[0.02] text-white/40',
                      showCorrect && 'border-emerald-500/50 bg-emerald-500/[0.10] text-emerald-100',
                      showWrong && 'border-rose-500/50 bg-rose-500/[0.10] text-rose-100',
                    )}
                  >
                    <span className="mono text-xs text-white/40 mr-3">{letter}</span>
                    {text}
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {revealed && current.explanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-6 rounded-xl border border-mint-500/20 bg-mint-500/[0.05] p-4">
                    <div className="mono text-[11px] text-mint-300 mb-2">EXPLANATION</div>
                    <div className="text-sm text-white/80 leading-relaxed">{current.explanation}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex justify-end"
              >
                <MotionButton onClick={advance}>
                  {cursor + 1 >= total ? 'See results' : 'Next question'} →
                </MotionButton>
              </motion.div>
            )}
          </GlassCard>
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 text-center mono text-[10px] text-white/30">
        {revealed ? 'space / enter = next' : '1/2/3/4 or A/B/C/D to pick'}
      </div>
    </div>
  );
}

export default function QuizPage() {
  return <Protected><QuizInner /></Protected>;
}
