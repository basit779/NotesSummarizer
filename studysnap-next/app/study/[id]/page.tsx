'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Check, X, Shuffle, ChevronRight, ChevronLeft, Trophy } from 'lucide-react';
import { api } from '@/lib/client/api';
import { Protected } from '@/components/Protected';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { cn } from '@/lib/utils';

interface Card { front: string; back: string; }
type CardState = 'new' | 'learning' | 'mastered';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function StudyInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [states, setStates] = useState<CardState[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [title, setTitle] = useState('Flashcards');

  useEffect(() => {
    api.get(`/results/${id}`).then((d) => {
      const c = d.result.flashcards as Card[];
      setCards(c);
      setStates(new Array(c.length).fill('new'));
      setOrder(c.map((_, i) => i));
      setTitle(d.result.title || d.result.file.filename);
    }).finally(() => setLoading(false));
  }, [id]);

  const currentIdx = order[cursor];
  const current = cards[currentIdx];
  const total = cards.length;
  const progress = total > 0 ? ((cursor) / total) * 100 : 0;
  const mastered = states.filter((s) => s === 'mastered').length;
  const learning = states.filter((s) => s === 'learning').length;

  const next = useCallback(() => {
    setFlipped(false);
    if (cursor + 1 >= order.length) {
      setFinished(true);
      return;
    }
    setCursor((c) => c + 1);
  }, [cursor, order.length]);

  const prev = useCallback(() => {
    setFlipped(false);
    setCursor((c) => Math.max(0, c - 1));
  }, []);

  const mark = useCallback((s: CardState) => {
    setStates((prev) => {
      const copy = [...prev];
      copy[currentIdx] = s;
      return copy;
    });
    next();
  }, [currentIdx, next]);

  const doShuffle = () => {
    setOrder(shuffle(order));
    setCursor(0);
    setFlipped(false);
    setFinished(false);
  };

  const retryMissed = () => {
    const stillLearning = order.filter((i) => states[i] === 'learning' || states[i] === 'new');
    if (stillLearning.length === 0) return;
    setOrder(stillLearning);
    setCursor(0);
    setFlipped(false);
    setFinished(false);
  };

  const restart = () => {
    setStates(new Array(cards.length).fill('new'));
    setOrder(cards.map((_, i) => i));
    setCursor(0);
    setFlipped(false);
    setFinished(false);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (finished) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === '1') { e.preventDefault(); mark('learning'); }
      else if (e.key === '2') { e.preventDefault(); mark('mastered'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, mark, finished]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[80vh] mono text-sm text-white/40">loading cards…</div>;
  }
  if (!cards.length) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <div className="mono text-xs text-white/40">no flashcards in this pack</div>
        <Link href={`/results/${id}`} className="mt-6 inline-block">
          <MotionButton variant="outline">Back to results</MotionButton>
        </Link>
      </div>
    );
  }

  if (finished) {
    const missed = states.filter((s) => s === 'learning').length;
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
          <GlassCard className="text-center !py-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-mint-500/30 bg-mint-500/[0.08]">
              <Trophy className="h-6 w-6 text-mint-400" />
            </div>
            <h2 className="mt-5 mono text-2xl font-semibold text-white">Session complete</h2>
            <p className="mt-1 text-sm text-white/55">{mastered} mastered · {missed} still learning · {total} total</p>

            <div className="mx-auto mt-8 max-w-sm flex flex-col gap-2">
              {missed > 0 && (
                <MotionButton onClick={retryMissed}>
                  <RotateCcw className="h-4 w-4" /> Retry {missed} missed
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 md:py-10">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Link href={`/results/${id}`} className="mono text-xs text-white/40 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer">
          <ArrowLeft className="h-3 w-3" /> exit
        </Link>
        <div className="mono text-xs text-white/50">{cursor + 1} / {total}</div>
        <button
          onClick={doShuffle}
          className="mono text-xs text-white/40 hover:text-mint-400 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Shuffle className="h-3 w-3" /> shuffle
        </button>
      </div>

      {/* Progress */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06] mb-2">
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="h-full bg-mint-500"
        />
      </div>
      <div className="flex justify-between mono text-[10px] text-white/40 mb-6">
        <span>{mastered} mastered</span>
        <span>{learning} learning</span>
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            onClick={() => setFlipped((f) => !f)}
            className="group relative h-[420px] w-full cursor-pointer text-left [perspective:1400px] focus:outline-none"
          >
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 22 }}
              className="relative h-full w-full [transform-style:preserve-3d]"
            >
              {/* front */}
              <div className="absolute inset-0 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 md:p-12 [backface-visibility:hidden] flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="mono text-[11px] text-mint-400">CARD · {String(cursor + 1).padStart(2, '0')}</div>
                  <div className="mono text-[11px] text-white/30">space to flip</div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-xl md:text-2xl font-medium leading-relaxed text-white text-balance text-center">
                    {current.front}
                  </div>
                </div>
              </div>
              {/* back */}
              <div className="absolute inset-0 rounded-2xl border border-mint-500/25 bg-mint-500/[0.06] backdrop-blur-xl p-8 md:p-12 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="mono text-[11px] text-mint-300">ANSWER</div>
                  <div className="mono text-[11px] text-white/40">space to flip back</div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-lg md:text-xl leading-relaxed text-white/95 text-balance text-center">
                    {current.back}
                  </div>
                </div>
              </div>
            </motion.div>
          </button>
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => mark('learning')}
          className="group flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] hover:bg-rose-500/[0.12] hover:border-rose-500/40 transition-colors px-4 py-3.5 text-sm text-rose-200 cursor-pointer"
        >
          <X className="h-4 w-4" /> Still learning <span className="mono text-[10px] text-rose-400/70 ml-1">1</span>
        </button>
        <button
          onClick={() => mark('mastered')}
          className="group flex items-center justify-center gap-2 rounded-xl border border-mint-500/25 bg-mint-500/[0.06] hover:bg-mint-500/[0.14] hover:border-mint-500/50 transition-colors px-4 py-3.5 text-sm text-mint-200 cursor-pointer"
        >
          <Check className="h-4 w-4" /> Got it <span className="mono text-[10px] text-mint-400/70 ml-1">2</span>
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={prev}
          disabled={cursor === 0}
          className="mono text-xs text-white/40 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> previous
        </button>
        <div className="mono text-[10px] text-white/30">space = flip · ← → = navigate · 1/2 = rate</div>
        <button
          onClick={next}
          className="mono text-xs text-white/40 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          skip <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function StudyPage() {
  return <Protected><StudyInner /></Protected>;
}
