'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

export function Flashcard({ front, back, index }: { front: string; back: string; index?: number }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((f) => !f)}
      className="group relative h-52 w-full cursor-pointer text-left [perspective:1200px] focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500/50 rounded-2xl"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative h-full w-full [transform-style:preserve-3d]"
      >
        <div className="absolute inset-0 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-5 [backface-visibility:hidden] group-hover:border-mint-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <div className="mono text-[10px] text-mint-400">
              CARD{typeof index === 'number' ? ` · ${String(index + 1).padStart(2, '0')}` : ''}
            </div>
            <div className="mono text-[10px] text-white/30">tap to flip</div>
          </div>
          <div className="mt-5 text-[15px] font-medium leading-relaxed text-white">{front}</div>
        </div>
        <div className="absolute inset-0 rounded-2xl border border-mint-500/25 bg-mint-500/[0.06] backdrop-blur-xl p-5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex items-center justify-between">
            <div className="mono text-[10px] text-mint-300">ANSWER</div>
            <div className="mono text-[10px] text-white/40">tap to flip back</div>
          </div>
          <div className="mt-5 text-[15px] leading-relaxed text-white/90">{back}</div>
        </div>
      </motion.div>
    </button>
  );
}
