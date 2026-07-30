'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Check, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';
import { api } from '@/lib/client/api';
import { useAuth } from '@/lib/client/auth';
import { Protected } from '@/components/Protected';
import { MotionButton } from '@/components/ui/MotionButton';
import { cn, GLOSS_BLACK } from '@/lib/utils';

const PRO_FEATURES = [
  'Unlimited uploads',
  'Priority AI processing',
  'Advanced exam questions',
  'Flashcard CSV export (Anki-ready)',
  'Priority model access',
  'Email support',
];

/** Compound plan card — Pro tier inverts to a solid black surface so the two
 *  tiers read as a clean black/white pair rather than needing an accent color. */
function PlanCard({
  plan,
  price,
  highlight,
  badge,
  features,
  footer,
  children,
}: {
  plan: string;
  price: string;
  highlight?: boolean;
  badge?: string;
  features: string[];
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-xl border',
        highlight ? cn('border-black', GLOSS_BLACK) : 'border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
      )}
    >
      {/* Header */}
      <div className="relative px-6 pt-6 pb-5">
        {badge && (
          <div className={cn(
            'absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide',
            highlight ? 'border border-white/25 bg-white/10 text-white' : 'border border-black/20 bg-black/5 text-black/70',
          )}>
            {badge}
          </div>
        )}
        <div className={cn('text-[12px] font-medium tracking-wide uppercase', highlight ? 'text-white/60' : 'text-black/50')}>
          {plan}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className={cn('text-[44px] font-semibold tracking-[-0.02em] leading-none', highlight ? 'text-white' : 'text-black')}>{price}</span>
          <span className={cn('text-sm', highlight ? 'text-white/40' : 'text-black/40')}>/ month</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6">
        <ul className="flex-1 space-y-3 pt-4">
          {features.map((f) => (
            <li key={f} className={cn('flex items-start gap-2.5 text-[13.5px] leading-relaxed', highlight ? 'text-white/80' : 'text-black/75')}>
              <span
                className={cn(
                  'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full',
                  highlight ? 'bg-white/[0.15]' : 'bg-black/[0.06]',
                )}
              >
                <Check className={cn('h-3 w-3', highlight ? 'text-white' : 'text-black/50')} />
              </span>
              {f}
            </li>
          ))}
        </ul>
        {children}
        {footer && <div className={cn('mt-6 text-[12px] font-medium tracking-wide', highlight ? 'text-white/40' : 'text-black/35')}>{footer}</div>}
      </div>
    </div>
  );
}

function BillingInner() {
  const { user, refresh } = useAuth();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [sub, setSub] = useState<any>(null);
  const [freeLimit, setFreeLimit] = useState<number | null>(null);

  useEffect(() => {
    api.get('/stripe/subscription-status').then((d) => setSub(d.subscription)).catch(() => {});
    // Live free-tier limit — single source of truth is the server env, not
    // hardcoded marketing copy that drifts.
    api.get('/dashboard').then((d) => {
      if (typeof d?.usage?.limit === 'number') setFreeLimit(d.usage.limit);
    }).catch(() => {});
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
  const freeFeatures = [
    `${freeLimit ?? 10} uploads / day`,
    'Structured notes & key points',
    'Flashcards & definitions',
    'Quiz with explained answers',
    'AI chat tutor',
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 md:px-6 py-12 md:py-16">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="text-[12px] font-medium text-black/45 uppercase tracking-wide">Billing</div>
        <h1 className="mt-3 text-[34px] md:text-[40px] font-semibold tracking-[-0.025em] leading-[1.05] text-black">
          {isPro ? "You're on Pro." : 'Upgrade when it clicks.'}
        </h1>
        <p className="mt-2 text-[13.5px] text-black/50">
          {isPro ? 'Unlimited uploads, priority processing, export tools.' : 'Start free. Upgrade any time. Cancel whenever.'}
        </p>
      </motion.div>

      {isPro && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }} className="mt-8">
          <div className={cn('relative overflow-hidden rounded-xl border border-black px-6 py-5', GLOSS_BLACK)}>
            <div className="relative flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-white" />
              <div className="text-sm font-medium text-white">Pro · Active</div>
            </div>
            {sub?.currentPeriodEnd && (
              <div className="relative mt-3 text-sm text-white/60">
                Renews on <span className="text-white">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2 items-stretch">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <PlanCard
            plan="Free"
            price="$0"
            features={freeFeatures}
            footer={!isPro ? 'Your current plan' : undefined}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.16 }}>
          <PlanCard
            plan="Pro"
            price="$9"
            highlight
            badge="Recommended"
            features={PRO_FEATURES}
            footer={isPro ? 'Your current plan' : undefined}
          >
            {!isPro && (
              <MotionButton className="mt-6 w-full !bg-white !text-black hover:!opacity-85" onClick={upgrade} loading={loading}>
                {loading ? 'Starting checkout…' : <>Upgrade to Pro <ArrowRight className="h-4 w-4" /></>}
              </MotionButton>
            )}
          </PlanCard>
        </motion.div>
      </div>

      <p className="mt-6 text-center text-[12px] text-black/35">
        No real payments in mock mode · Stripe activates when account is connected
      </p>

      {process.env.NODE_ENV !== 'production' && (
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
            className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.1] bg-black/[0.02] px-3 py-1.5 text-[12px] text-black/50 transition-colors duration-150 hover:border-black/20 hover:bg-black/[0.05] hover:text-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" /> Reset today's usage (dev)
          </button>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return <Protected><BillingInner /></Protected>;
}
