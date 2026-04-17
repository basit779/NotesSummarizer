'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FileText, Upload as UploadIcon, ArrowRight, Sparkles, Clock,
  TrendingUp, Zap, BookOpen,
} from 'lucide-react';
import { api } from '@/lib/client/api';
import { useAuth } from '@/lib/client/auth';
import { Protected } from '@/components/Protected';
import { MotionButton } from '@/components/ui/MotionButton';
import { UsageBar } from '@/components/UsageBar';

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

function StatTile({
  label, value, hint, icon: Icon, accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof TrendingUp;
  accent?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 ${accent
        ? 'border-mint-500/20 bg-gradient-to-br from-mint-500/[0.06] to-transparent'
        : 'border-white/[0.06] bg-gradient-to-br from-white/[0.025] to-transparent'
      }`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${accent
            ? 'border-mint-500/25 bg-mint-500/[0.08]'
            : 'border-white/[0.08] bg-white/[0.03]'
          }`}>
          <Icon className={`h-4 w-4 ${accent ? 'text-mint-400' : 'text-white/65'}`} />
        </div>
        <div className="mono text-[10px] text-white/40 tracking-wider">{label}</div>
      </div>
      <div className="mono text-[28px] font-semibold text-white tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[11.5px] text-white/40">{hint}</div>}
    </div>
  );
}

function DashboardInner() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get('/dashboard').then(setData).catch(() => {});
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? 'friend';
  const isPro = user?.plan === 'PRO';

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-10 md:py-12">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mono text-[11px] text-mint-400 tracking-wider">// dashboard</div>
        <h1 className="mt-2 mono text-[36px] md:text-[48px] leading-[1.05] font-semibold tracking-tightest text-white">
          Hey, {firstName}.
        </h1>
        <p className="mt-2 text-white/55 text-[15px]">Ready to turn notes into knowledge?</p>
      </motion.div>

      {/* Hero CTA — bento style */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.08 }}
        className="mt-9 grid md:grid-cols-[1.5fr_1fr] gap-4"
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-mint-500/[0.08] via-white/[0.02] to-transparent p-6 md:p-8">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-mint-500/[0.12] blur-3xl" aria-hidden />
          <div className="absolute inset-0 bg-grain opacity-[0.03]" aria-hidden />
          <div className="relative">
            <div className="mono text-[11px] text-mint-300 tracking-wider">NEW UPLOAD</div>
            <h2 className="mt-2 mono text-[26px] md:text-[30px] leading-tight font-semibold text-white tracking-tight">
              Drop a PDF.<br />Get a study pack.
            </h2>
            <p className="mt-3 max-w-md text-[14px] text-white/55 leading-relaxed">
              We extract the text, route through the best available free-tier AI model, and return summaries, flashcards, definitions, and exam questions.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/upload">
                <MotionButton size="lg">
                  <UploadIcon className="h-4 w-4" /> New upload <ArrowRight className="h-4 w-4" />
                </MotionButton>
              </Link>
              <Link href="/history">
                <MotionButton size="lg" variant="outline">View history</MotionButton>
              </Link>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-6 flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex items-center gap-2">
              <div className="mono text-[11px] text-white/50 tracking-wider">TODAY'S USAGE</div>
              {isPro && <span className="mono text-[10px] rounded-full border border-mint-500/30 bg-mint-500/15 px-2 py-0.5 text-mint-300">PRO</span>}
            </div>
            <div className="mt-4">
              <UsageBar used={data?.usage.uploads ?? 0} limit={data?.usage.limit ?? 10} />
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-white/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] text-white/60">
              <Zap className="h-3.5 w-3.5 text-mint-400" />
              {isPro ? 'Unlimited access' : 'Free plan'}
            </div>
            {!isPro && (
              <Link href="/billing" className="mono text-[11px] text-mint-400 hover:text-mint-300 transition-colors cursor-pointer inline-flex items-center gap-1">
                upgrade <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* Lifetime stats */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.16 }}
        className="mt-5 grid gap-4 md:grid-cols-3"
      >
        <StatTile label="TOTAL UPLOADS" value={data?.totals.uploads ?? '—'} hint="All time" icon={UploadIcon} />
        <StatTile label="PACKS GENERATED" value={data?.totals.processed ?? '—'} hint="Summaries, cards, quizzes" icon={BookOpen} accent />
        <StatTile
          label="STREAK"
          value={data ? (data.totals.processed > 0 ? 'Active' : 'Start one') : '—'}
          hint="Keep the rhythm"
          icon={TrendingUp}
        />
      </motion.div>

      {/* Recent packs */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.24 }}
        className="mt-10"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="mono text-[11px] text-white/45 tracking-wider">// recent</div>
            <h3 className="mt-1 mono text-[22px] font-semibold text-white">Latest study packs</h3>
          </div>
          <Link href="/history" className="mono text-[11px] text-white/50 hover:text-mint-400 transition-colors cursor-pointer inline-flex items-center gap-1">
            view all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {data && data.recent.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.015] text-center py-14 px-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-mint-500/25 bg-gradient-to-b from-mint-500/[0.10] to-transparent">
              <Sparkles className="h-6 w-6 text-mint-400" />
            </div>
            <h4 className="mt-5 mono font-semibold text-white text-lg">No packs yet</h4>
            <p className="mt-1.5 text-[13.5px] text-white/50">Upload your first PDF to get started.</p>
            <Link href="/upload" className="inline-block mt-6">
              <MotionButton size="sm"><UploadIcon className="h-3.5 w-3.5" /> Upload a PDF</MotionButton>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data?.recent.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.28 + i * 0.04 }}
              >
                <Link href={`/results/${r.id}`} className="block group cursor-pointer">
                  <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.025] to-transparent p-4 flex items-center justify-between gap-4 hover:border-mint-500/25 hover:from-mint-500/[0.04] transition-all">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] group-hover:border-mint-500/30 group-hover:bg-mint-500/[0.06] transition-colors">
                        <FileText className="h-4 w-4 text-white/70 group-hover:text-mint-400 transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14.5px] font-medium text-white">{r.file.filename}</div>
                        <div className="mt-0.5 flex items-center gap-2 mono text-[11px] text-white/40">
                          <Clock className="h-3 w-3" />
                          <span>{relativeTime(r.createdAt)}</span>
                          <span className="text-white/20">·</span>
                          <span>{r.file.pageCount ?? '?'} pages</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-mint-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function DashboardPage() {
  return <Protected><DashboardInner /></Protected>;
}
