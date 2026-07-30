'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { cn, GLOSS_BLACK } from '@/lib/utils';

export function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <GlassCard className={cn('relative overflow-hidden !border-black', GLOSS_BLACK)}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-white" />
          <div className="text-[12px] font-medium text-white/70 uppercase tracking-wide">Pro · Unlimited</div>
        </div>
        <div className="mt-4 text-2xl font-semibold text-white">∞ uploads</div>
        <div className="mt-1 text-xs text-white/50">Process as many PDFs as you need.</div>
      </GlassCard>
    );
  }
  const pct = Math.min(100, (used / Math.max(limit, 1)) * 100);
  return (
    <GlassCard>
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-medium text-black/45 uppercase tracking-wide">Daily usage</div>
        <div className="text-xs text-black/70">{used} / {limit}</div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="h-full bg-black"
        />
      </div>
      <div className="mt-3 text-xs text-black/50">
        {limit - used > 0 ? `${limit - used} uploads left today.` : 'Limit reached. Upgrade for unlimited.'}
      </div>
    </GlassCard>
  );
}
