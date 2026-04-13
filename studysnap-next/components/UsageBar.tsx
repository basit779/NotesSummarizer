'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';

export function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <GlassCard className="relative overflow-hidden border-mint-500/20 !bg-gradient-to-br from-mint-500/[0.08] to-transparent">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-mint-400" />
          <div className="mono text-xs text-mint-300">PRO · UNLIMITED</div>
        </div>
        <div className="mt-4 text-2xl mono font-semibold text-white">∞ uploads</div>
        <div className="mt-1 text-xs text-white/50">Process as many PDFs as you need.</div>
      </GlassCard>
    );
  }
  const pct = Math.min(100, (used / Math.max(limit, 1)) * 100);
  return (
    <GlassCard>
      <div className="flex items-center justify-between">
        <div className="mono text-xs text-white/50">DAILY USAGE</div>
        <div className="mono text-xs text-white/70">{used} / {limit}</div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="h-full bg-gradient-to-r from-mint-500 to-mint-400"
        />
      </div>
      <div className="mt-3 text-xs text-white/50">
        {limit - used > 0 ? `${limit - used} uploads left today.` : 'Limit reached. Upgrade for unlimited.'}
      </div>
    </GlassCard>
  );
}
