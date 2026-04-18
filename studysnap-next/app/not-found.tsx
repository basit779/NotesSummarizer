'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { MotionButton } from '@/components/ui/MotionButton';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 md:px-6 py-24 md:py-32 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mono text-[11px] text-mint-400 tracking-widest">// 404</div>
        <h1 className="mt-3 mono text-[40px] md:text-[56px] leading-[1.05] font-semibold tracking-tightest text-white text-balance">
          Lost in the notes <span className="inline-block">📚</span>
        </h1>
        <p className="mt-4 text-white/55 text-[15px] md:text-[16px] max-w-md mx-auto">
          This page doesn&rsquo;t exist. Might be a stale link, a typo, or a pack that was deleted.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-10 flex items-center justify-center"
      >
        <Link href="/dashboard">
          <MotionButton variant="primary" size="md">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </MotionButton>
        </Link>
      </motion.div>
    </div>
  );
}
