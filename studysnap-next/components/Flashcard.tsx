'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { cn, GLOSS_BLACK } from '@/lib/utils';

export function Flashcard({ front, back, index }: { front: string; back: string; index?: number }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((f) => !f)}
      className="group relative h-52 w-full cursor-pointer text-left [perspective:1200px] focus:outline-none focus-visible:ring-2 focus-visible:ring-black/50 rounded-2xl"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative h-full w-full [transform-style:preserve-3d]"
      >
        <div className="absolute inset-0 rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 [backface-visibility:hidden] group-hover:border-black/25 transition-colors">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-black/45 uppercase tracking-wide">
              Card{typeof index === 'number' ? ` ${index + 1}` : ''}
            </div>
            <div className="text-[11px] text-black/30">Tap to flip</div>
          </div>
          <div className="mt-5 text-[15px] font-medium leading-relaxed text-black">{front}</div>
        </div>
        <div className={cn('absolute inset-0 rounded-2xl border border-black p-5 [backface-visibility:hidden] [transform:rotateY(180deg)]', GLOSS_BLACK)}>
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-white/70 uppercase tracking-wide">Answer</div>
            <div className="text-[11px] text-white/40">Tap to flip back</div>
          </div>
          <div className="mt-5 text-[15px] leading-relaxed text-white/90">{back}</div>
        </div>
      </motion.div>
    </button>
  );
}
