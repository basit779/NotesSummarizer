'use client';

import { motion } from 'framer-motion';

export function GridBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-ink-950" />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 80%)',
        }}
      />
      <motion.div
        initial={{ opacity: 0.25 }}
        animate={{ opacity: [0.2, 0.35, 0.2], x: [0, 40, 0], y: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(closest-side, rgba(16,185,129,0.35), transparent 70%)' }}
      />
      <motion.div
        initial={{ opacity: 0.18 }}
        animate={{ opacity: [0.15, 0.28, 0.15], x: [0, -30, 0], y: [0, 25, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/3 -right-52 h-[620px] w-[620px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(closest-side, rgba(59,130,246,0.22), transparent 70%)' }}
      />
      <div className="absolute inset-0 bg-grain opacity-[0.035] mix-blend-overlay" />
    </div>
  );
}
