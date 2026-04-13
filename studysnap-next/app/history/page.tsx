'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, ArrowRight, Clock, Sparkles } from 'lucide-react';
import { api } from '@/lib/client/api';
import { Protected } from '@/components/Protected';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';

interface Item {
  id: string;
  createdAt: string;
  summary: string;
  file: { filename: string; pageCount: number | null; sizeBytes: number };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function HistoryInner() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/history').then((d) => setItems(d.items)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mono text-xs text-mint-400">// history</div>
        <h1 className="mt-2 mono text-4xl font-semibold tracking-tightest text-white">All study packs</h1>
        <p className="mt-2 text-white/55">{items.length} {items.length === 1 ? 'pack' : 'packs'} generated.</p>
      </motion.div>

      {loading ? (
        <div className="mt-10 space-y-3">
          {[0, 1, 2].map((i) => (<div key={i} className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />))}
        </div>
      ) : items.length === 0 ? (
        <GlassCard className="mt-10 text-center !py-16">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            <Sparkles className="h-6 w-6 text-mint-400" />
          </div>
          <h3 className="mt-5 mono text-lg font-semibold text-white">No packs yet</h3>
          <p className="mt-1 text-sm text-white/50">Upload your first PDF to start your library.</p>
          <Link href="/upload" className="inline-block mt-6"><MotionButton>Upload a PDF</MotionButton></Link>
        </GlassCard>
      ) : (
        <div className="mt-10 grid gap-3">
          {items.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}>
              <Link href={`/results/${r.id}`} className="block group cursor-pointer">
                <GlassCard glow>
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] group-hover:border-mint-500/30 group-hover:bg-mint-500/[0.06] transition-colors">
                      <FileText className="h-4 w-4 text-white/70 group-hover:text-mint-400 transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">{r.file.filename}</div>
                          <div className="mt-1 flex items-center gap-2 mono text-[11px] text-white/40">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                            <span className="text-white/20">·</span>
                            <span>{r.file.pageCount ?? '?'} pages</span>
                            <span className="text-white/20">·</span>
                            <span>{formatBytes(r.file.sizeBytes)}</span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-mint-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                      <p className="mt-3 text-sm text-white/55 line-clamp-2 leading-relaxed">{r.summary}</p>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return <Protected><HistoryInner /></Protected>;
}
