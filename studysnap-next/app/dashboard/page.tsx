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
import { TiltCard } from '@/components/ui/TiltCard';
import { cn } from '@/lib/utils';

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

function StatTile({ label, value, hint, icon: Icon, accent }: any) {
  return (
    <TiltCard glowOpacity={accent ? 0.08 : 0.04} className="h-full">
      <div className="flex flex-col h-full z-10 relative">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", accent ? "border-black bg-black" : "border-black/10 bg-black/[0.04]")}>
            <Icon className={cn("h-5 w-5", accent ? "text-white" : "text-black/60")} />
          </div>
          <div className="text-[10px] uppercase font-mono tracking-widest text-black/40">{label}</div>
        </div>
        <div className="text-4xl font-bold tracking-tight text-black">{value}</div>
        {hint && <div className="mt-2 text-xs text-black/40 font-mono tracking-wider">{hint}</div>}
      </div>
    </TiltCard>
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

  // Stagger config
  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } } };

  return (
    <div className="min-h-screen relative overflow-hidden bg-white font-sans">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-16 md:py-24 relative z-10">
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-12">

          {/* Header */}
          <motion.div variants={item}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[0.04] border border-black/[0.08] mb-6">
              <span className="h-2 w-2 rounded-full bg-black" />
              <span className="text-xs font-mono tracking-widest uppercase text-black/60">Dashboard</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-black">
              Welcome back, <br/>
              <span className="text-black">{firstName}.</span>
            </h1>
          </motion.div>

          {/* Bento Grid */}
          <motion.div variants={item} className="grid md:grid-cols-[2fr_1fr] gap-6">
            <TiltCard glowOpacity={0.06} className="relative overflow-hidden cursor-pointer" glowClassName="bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.08),transparent_40%)]">
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="text-[10px] font-mono text-black/50 tracking-widest uppercase mb-4">Command Center</div>
                  <h2 className="text-3xl md:text-4xl font-bold text-black mb-2 tracking-tight">Drop a PDF.<br/>Get mastery.</h2>
                  <p className="text-black/50 text-sm max-w-sm leading-relaxed mb-8">
                    Our AI models extract exact concepts, creating a fully interactive study environment tailored just for you.
                  </p>
                </div>
                <div className="flex gap-4">
                  <Link href="/upload">
                    <MotionButton size="lg">
                      <UploadIcon className="h-4 w-4" /> Upload New PDF
                    </MotionButton>
                  </Link>
                </div>
              </div>
            </TiltCard>

            <TiltCard glowOpacity={0.04} className="flex flex-col justify-between">
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-6">
                  <div className="text-[10px] font-mono text-black/50 tracking-widest uppercase">Limits</div>
                  {isPro && <div className="text-[9px] font-mono border border-black bg-black px-2 py-0.5 rounded-full text-white">PRO TIER</div>}
                </div>
                <UsageBar used={data?.usage.uploads ?? 0} limit={data?.usage.limit ?? 10} />
              </div>
              <div className="relative z-10 mt-8 pt-4 border-t border-black/[0.08] flex justify-between items-center">
                 <div className="text-sm text-black/60 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-black/60" />
                    {isPro ? 'Unlimited Access' : 'Free Tier'}
                 </div>
                 {!isPro && (
                   <Link href="/billing" className="text-xs text-black hover:text-black/70 font-medium">Upgrade &rarr;</Link>
                 )}
              </div>
            </TiltCard>
          </motion.div>

          {/* Stats Row */}
          <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatTile label="Total Uploads" value={data?.totals.uploads ?? '0'} hint="Lifetime" icon={UploadIcon} />
            <StatTile label="Packs Built" value={data?.totals.processed ?? '0'} hint="Flashcards & Quizzes" icon={BookOpen} accent={true} />
            <StatTile label="Streak" value={data && data.totals.processed > 0 ? 'Active' : 'Get Started'} hint="Consistency is key" icon={TrendingUp} />
          </motion.div>

          {/* Recent History */}
          <motion.div variants={item} className="mt-12">
            <div className="flex items-end justify-between mb-8 border-b border-black/[0.08] pb-4">
              <h3 className="text-2xl font-bold tracking-tight text-black">Recent Intel</h3>
              <Link href="/history" className="text-xs font-mono uppercase tracking-widest text-black/60 hover:text-black transition-colors">View All Archive</Link>
            </div>

            {data && data.recent.length === 0 ? (
              <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-12 text-center flex flex-col items-center">
                 <div className="h-16 w-16 rounded-2xl bg-black flex items-center justify-center mb-6">
                    <Sparkles className="h-8 w-8 text-white" />
                 </div>
                 <h4 className="text-xl font-bold text-black mb-2">The archive is empty</h4>
                 <p className="text-black/50 text-sm max-w-xs mx-auto mb-8">Upload your first chapter to generate an elite study environment.</p>
                 <Link href="/upload"><MotionButton>Upload PDF</MotionButton></Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {data?.recent.map((r, i) => (
                   <Link href={`/results/${r.id}`} key={r.id}>
                     <TiltCard glowOpacity={0.04} className="group hover:border-black/30 transition-all cursor-pointer h-full p-4">
                        <div className="flex items-center gap-4 z-10 relative">
                           <div className="h-12 w-12 rounded-xl bg-black/[0.03] border border-black/10 flex items-center justify-center group-hover:bg-black group-hover:border-black transition-colors">
                              <FileText className="h-5 w-5 text-black/50 group-hover:text-white transition-colors" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className="text-base font-semibold text-black truncate">{r.file.filename}</div>
                              <div className="text-xs font-mono tracking-widest text-black/40 uppercase mt-1 flex items-center gap-2">
                                 <Clock className="h-3 w-3" /> {relativeTime(r.createdAt)} <span className="text-black/20">|</span> {r.file.pageCount ?? '?'} pgs
                              </div>
                           </div>
                           <ArrowRight className="h-5 w-5 text-black/20 group-hover:text-black group-hover:translate-x-1 transition-all" />
                        </div>
                     </TiltCard>
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
