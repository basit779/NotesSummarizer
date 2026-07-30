'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { api } from '@/lib/client/api';
import { useAuth } from '@/lib/client/auth';
import { cn, GLOSS_BLACK } from '@/lib/utils';

export function UsageIndicator() {
  const user = useAuth((s) => s.user);
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(3);

  useEffect(() => {
    if (!user) return;
    api.get('/dashboard').then((data) => {
      setUsed(data?.usage?.uploads ?? 0);
      setLimit(data?.usage?.limit ?? 3);
    }).catch(() => {});
  }, [user]);

  if (!user) return null;

  if (user.plan === 'PRO') {
    return (
      <div className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-white', GLOSS_BLACK)}>
        <Sparkles className="h-3 w-3" />
        <span>Pro · unlimited</span>
      </div>
    );
  }

  const pct = Math.min(100, (used / Math.max(limit, 1)) * 100);
  return (
    <div className="flex items-center gap-2 rounded-full border border-black/[0.1] bg-black/[0.03] px-3 py-1 text-xs text-black/70">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-black/[0.1]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
          className="h-full bg-black"
        />
      </div>
      <span>{used}/{limit}</span>
    </div>
  );
}
