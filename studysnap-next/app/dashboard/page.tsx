'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FileText, Upload as UploadIcon, ArrowRight, Sparkles, Clock,
} from 'lucide-react';
import { api } from '@/lib/client/api';
import { useAuth } from '@/lib/client/auth';
import { Protected } from '@/components/Protected';
import { MotionButton } from '@/components/ui/MotionButton';
import { UsageBar } from '@/components/UsageBar';
import { cn, GLOSS_BLACK } from '@/lib/utils';

interface DashboardData {
  usage: { uploads: number; processed: number; limit: number | null; plan: string };
  recent: Array<{ id: string; createdAt: string; file: { filename: string; pageCount: number | null } }>;
  totals: { uploads: number; processed: number };
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function DashboardInner() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get('/dashboard').then(setData).catch(() => {});
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? 'friend';
  const isPro = user?.plan === 'PRO';

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-5 md:px-6 py-16 md:py-24">
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-16">

          {/* Header */}
          <motion.div variants={item} className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <h1 className="text-4xl md:text-6xl font-semibold tracking-[-0.03em] leading-[1.05] text-black">
              Welcome back, {firstName}.
            </h1>
            <Link href="/upload" className="shrink-0">
              <MotionButton size="lg">
                <UploadIcon className="h-4 w-4" /> Upload a PDF
              </MotionButton>
            </Link>
          </motion.div>

          {/* Stat strip */}
          <motion.div variants={item} className="grid grid-cols-3 divide-x divide-black/[0.08] border-y border-black/[0.08] py-6">
            <div className="px-2 first:pl-0 md:px-6">
              <div className="text-4xl font-semibold tracking-tight text-black">{data?.totals.uploads ?? '—'}</div>
              <div className="mt-1 text-[13px] text-black/45">Total uploads</div>
            </div>
            <div className="px-2 md:px-6">
              <div className="text-4xl font-semibold tracking-tight text-black">{data?.totals.processed ?? '—'}</div>
              <div className="mt-1 text-[13px] text-black/45">Packs built</div>
            </div>
            <div className="px-2 md:px-6">
              <div className="text-4xl font-semibold tracking-tight text-black">{isPro ? '∞' : `${data?.usage.limit ?? 10}`}</div>
              <div className="mt-1 text-[13px] text-black/45">{isPro ? 'Unlimited plan' : 'Daily upload limit'}</div>
            </div>
          </motion.div>

          {/* Usage */}
          {!isPro && (
            <motion.div variants={item} className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
              <div className="flex-1 max-w-md">
                <UsageBar used={data?.usage.uploads ?? 0} limit={data?.usage.limit ?? 10} />
              </div>
              <Link href="/billing" className="text-sm font-medium text-black hover:text-black/60 transition-colors inline-flex items-center gap-1.5 shrink-0">
                Upgrade to Pro <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          )}

          {/* Recent History */}
          <motion.div variants={item}>
            <div className="flex items-end justify-between mb-6">
              <h3 className="text-xl font-semibold tracking-tight text-black">Recent packs</h3>
              <Link href="/history" className="text-[13px] text-black/45 hover:text-black transition-colors">View all</Link>
            </div>

            {data && data.recent.length === 0 ? (
              <div className="rounded-2xl border border-black/[0.08] px-8 py-16 text-center">
                <div className={cn('mx-auto flex h-14 w-14 items-center justify-center rounded-2xl', GLOSS_BLACK)}>
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h4 className="mt-5 text-lg font-semibold text-black">Nothing here yet</h4>
                <p className="mt-1.5 text-sm text-black/50 max-w-xs mx-auto">Upload your first document to generate a study pack.</p>
                <Link href="/upload" className="mt-6 inline-block"><MotionButton>Upload PDF</MotionButton></Link>
              </div>
            ) : (
              <div className="divide-y divide-black/[0.08] border-y border-black/[0.08]">
                {data?.recent.map((r) => (
                  <Link href={`/results/${r.id}`} key={r.id} className="group flex items-center gap-4 py-4 hover:px-2 transition-all cursor-pointer">
                    <FileText className="h-4 w-4 text-black/30 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-medium text-black truncate">{r.file.filename}</div>
                      <div className="text-[13px] text-black/40 flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-3 w-3" /> {relativeTime(r.createdAt)} · {r.file.pageCount ?? '?'} pages
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-black/20 group-hover:text-black group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <Protected><DashboardInner /></Protected>;
}
