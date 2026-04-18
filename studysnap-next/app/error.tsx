'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { RotateCcw, ArrowLeft } from 'lucide-react';
import { MotionButton } from '@/components/ui/MotionButton';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-5 md:px-6 py-24 md:py-32 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mono text-[11px] text-amber-400 tracking-widest">// 500</div>
        <h1 className="mt-3 mono text-[40px] md:text-[56px] leading-[1.05] font-semibold tracking-tightest text-white text-balance">
          Something went sideways.
        </h1>
        <p className="mt-4 text-white/55 text-[15px] md:text-[16px] max-w-md mx-auto">
          We&rsquo;re on it. Try again, or head back and pick up where you left off.
        </p>
        {error?.digest && (
          <div className="mt-4 mono text-[10.5px] text-white/30 tracking-wider">
            ref: {error.digest}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-10 flex items-center justify-center gap-3"
      >
        <MotionButton variant="primary" size="md" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          Try again
        </MotionButton>
        <Link href="/dashboard">
          <MotionButton variant="outline" size="md">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </MotionButton>
        </Link>
      </motion.div>
    </div>
  );
}
