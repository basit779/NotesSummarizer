'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Check, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';
import { api } from '@/lib/client/api';
import { useAuth } from '@/lib/client/auth';
import { Protected } from '@/components/Protected';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';

const FREE_FEATURES = ['3 PDF uploads / day', 'Summaries & key points', 'Flashcards & definitions', 'Exam questions'];
const PRO_FEATURES = [
  'Unlimited uploads', 'Priority AI processing', 'Advanced exam questions',
  'Flashcard CSV export', 'Priority model access', 'Email support',
];

function BillingInner() {
  const { user, refresh } = useAuth();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [sub, setSub] = useState<any>(null);

  useEffect(() => {
    api.get('/stripe/subscription-status').then((d) => setSub(d.subscription)).catch(() => {});
  }, []);

  useEffect(() => {
    if (params.get('success') || params.get('mock')) {
      toast.success(params.get('mock') ? 'Upgraded (mock mode)' : 'Welcome to Pro');
      setTimeout(() => refresh(), 1200);
    } else if (params.get('canceled')) {
      toast.info('Checkout canceled');
    }
  }, [params, refresh]);

  async function upgrade() {
    setLoading(true);
    try {
      const data = await api.post('/stripe/checkout');
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not start checkout');
      setLoading(false);
    }
  }

  const isPro = user?.plan === 'PRO';

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mono text-xs text-mint-400">// billing</div>
        <h1 className="mt-2 mono text-4xl font-semibold tracking-tightest text-white">
          {isPro ? "You're on Pro." : 'Upgrade when it clicks.'}
        </h1>
        <p className="mt-2 text-white/55">
          {isPro ? 'Unlimited uploads, priority processing, export tools.' : 'Start free. Upgrade any time. Cancel whenever.'}
        </p>
      </motion.div>

      {isPro && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="mt-8">
          <GlassCard className="relative overflow-hidden border-mint-500/25 !bg-gradient-to-br from-mint-500/[0.06] to-transparent">
            <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-mint-500/[0.12] blur-3xl" />
            <div className="relative flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-mint-400" />
              <div className="mono text-sm text-mint-300">PRO · ACTIVE</div>
            </div>
            {sub?.currentPeriodEnd && (
              <div className="relative mt-4 text-sm text-white/60">
                Renews on <span className="text-white">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</span>
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.12 }}>
          <GlassCard className="h-full">
            <div className="mono text-xs text-white/50">FREE</div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="mono text-5xl font-semibold text-white">$0</span>
              <span className="text-white/40 text-sm">/mo</span>
            </div>
            <ul className="mt-8 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                  <Check className="mt-0.5 h-4 w-4 text-mint-400 shrink-0" />{f}
                </li>
              ))}
            </ul>
            <div className="mt-8 mono text-xs text-white/40">{!isPro ? 'Your current plan' : ''}</div>
          </GlassCard>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
          <GlassCard className="relative h-full overflow-hidden border-mint-500/25 !bg-gradient-to-b from-mint-500/[0.06] to-white/[0.02]">
            <div className="absolute top-4 right-4 rounded-full border border-mint-500/30 bg-mint-500/[0.12] px-2 py-0.5 mono text-[10px] text-mint-300">RECOMMENDED</div>
            <div className="mono text-xs text-mint-400">PRO</div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="mono text-5xl font-semibold text-white">$9</span>
              <span className="text-white/40 text-sm">/mo</span>
            </div>
            <ul className="mt-8 space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                  <Check className="mt-0.5 h-4 w-4 text-mint-400 shrink-0" />{f}
                </li>
              ))}
            </ul>
            {!isPro && (
              <MotionButton className="mt-8 w-full" onClick={upgrade} loading={loading}>
                {loading ? 'Starting checkout…' : <>Upgrade to Pro <ArrowRight className="h-4 w-4" /></>}
              </MotionButton>
            )}
          </GlassCard>
        </motion.div>
      </div>

      <p className="mt-6 mono text-[11px] text-white/30 text-center">
        no real payments in mock mode · stripe activates when account is connected
      </p>

      <div className="mt-10 flex justify-center">
        <button
          onClick={async () => {
            try {
              const data = await api.post('/dev/reset-usage');
              toast.success(`Usage reset (${data.deleted} records cleared)`);
              setTimeout(() => window.location.reload(), 800);
            } catch (err: any) {
              toast.error(err?.message ?? 'Reset failed');
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] px-3 py-1.5 mono text-[11px] text-white/50 hover:text-white/80 transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" /> reset today's usage (dev)
        </button>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return <Protected><BillingInner /></Protected>;
}
