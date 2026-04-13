import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Upload as UploadIcon, ArrowRight, Sparkles, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { UsageBar } from '@/components/UsageBar';

interface DashboardData {
  usage: { uploads: number; processed: number; limit: number | null; plan: string };
  recent: Array<{ id: string; createdAt: string; file: { filename: string; pageCount: number | null } }>;
  totals: { uploads: number; processed: number };
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <GlassCard>
      <div className="mono text-xs text-white/50">{label}</div>
      <div className="mt-3 mono text-3xl font-semibold text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-white/40">{hint}</div>}
    </GlassCard>
  );
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

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data)).catch(() => {});
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? 'friend';

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mono text-xs text-mint-400">// dashboard</div>
        <h1 className="mt-2 mono text-4xl md:text-5xl font-semibold tracking-tightest text-white">
          Hey, {firstName}.
        </h1>
        <p className="mt-2 text-white/55">Ready to turn notes into knowledge?</p>
      </motion.div>

      {/* Primary CTA card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="mt-10"
      >
        <GlassCard className="relative overflow-hidden !p-8">
          <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-mint-500/[0.12] blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="mono text-xs text-mint-400">NEW UPLOAD</div>
              <h2 className="mt-2 mono text-2xl font-semibold text-white">Drop a PDF. Get a study pack.</h2>
              <p className="mt-2 max-w-xl text-sm text-white/55">
                We extract text, route it through the best available AI model, and return summaries,
                flashcards, definitions, and exam questions.
              </p>
            </div>
            <Link to="/upload">
              <MotionButton size="lg" className="shrink-0">
                <UploadIcon className="h-4 w-4" /> New upload <ArrowRight className="h-4 w-4" />
              </MotionButton>
            </Link>
          </div>
        </GlassCard>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.18 }}
        className="mt-6 grid gap-4 md:grid-cols-3"
      >
        <UsageBar used={data?.usage.uploads ?? 0} limit={data?.usage.limit ?? 3} />
        <Stat label="TOTAL UPLOADS" value={data?.totals.uploads ?? '—'} hint="All time" />
        <Stat label="PACKS GENERATED" value={data?.totals.processed ?? '—'} hint="All time" />
      </motion.div>

      {/* Recent */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.26 }}
        className="mt-10"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="mono text-xs text-white/50">// recent</div>
            <h3 className="mt-1 mono text-xl font-semibold text-white">Latest study packs</h3>
          </div>
          <Link to="/history" className="mono text-xs text-white/50 hover:text-mint-400 transition-colors cursor-pointer inline-flex items-center gap-1">
            view all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {data && data.recent.length === 0 ? (
          <GlassCard className="text-center !py-14">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
              <Sparkles className="h-5 w-5 text-mint-400" />
            </div>
            <h4 className="mt-4 mono font-semibold text-white">No packs yet</h4>
            <p className="mt-1 text-sm text-white/50">Upload your first PDF to get started.</p>
            <Link to="/upload" className="inline-block mt-5">
              <MotionButton size="sm">Upload a PDF</MotionButton>
            </Link>
          </GlassCard>
        ) : (
          <div className="grid gap-3">
            {data?.recent.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}
              >
                <Link to={`/results/${r.id}`} className="block group cursor-pointer">
                  <GlassCard glow className="!p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] group-hover:border-mint-500/30 transition-colors">
                        <FileText className="h-4 w-4 text-white/70 group-hover:text-mint-400 transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">{r.file.filename}</div>
                        <div className="mt-0.5 flex items-center gap-2 mono text-[11px] text-white/40">
                          <Clock className="h-3 w-3" />
                          <span>{relativeTime(r.createdAt)}</span>
                          <span className="text-white/20">·</span>
                          <span>{r.file.pageCount ?? '?'} pages</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-mint-400 group-hover:translate-x-0.5 transition-all" />
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
