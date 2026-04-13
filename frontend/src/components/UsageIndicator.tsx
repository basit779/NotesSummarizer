import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Sparkles } from 'lucide-react';

export function UsageIndicator() {
  const user = useAuth((s) => s.user);
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(3);

  useEffect(() => {
    if (!user) return;
    api.get('/dashboard').then(({ data }) => {
      setUsed(data?.usage?.uploads ?? 0);
      setLimit(data?.usage?.limit ?? 3);
    }).catch(() => {});
  }, [user]);

  if (!user) return null;

  if (user.plan === 'PRO') {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-mint-500/25 bg-mint-500/[0.06] px-3 py-1 text-xs text-mint-400">
        <Sparkles className="h-3 w-3" />
        <span className="mono">PRO · unlimited</span>
      </div>
    );
  }

  const pct = Math.min(100, (used / Math.max(limit, 1)) * 100);
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-white/70">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="h-full bg-mint-500"
        />
      </div>
      <span className="mono">{used}/{limit}</span>
    </div>
  );
}
