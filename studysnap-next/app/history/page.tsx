'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, ArrowRight, Sparkles, Search, Layers, HelpCircle, Library, Loader2 } from 'lucide-react';
import { api } from '@/lib/client/api';
import { Protected } from '@/components/Protected';
import { MotionButton } from '@/components/ui/MotionButton';
import { cn } from '@/lib/utils';

interface Item {
  id: string;
  createdAt: string;
  summary: string;
  flashcards?: unknown[];
  examQuestions?: unknown[];
  definitions?: unknown[];
  file: { filename: string; pageCount: number | null; sizeBytes: number };
}

const PAGE_SIZE = 20;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Strip markdown syntax for the 2-line preview — raw "## Overview" and
 *  "**bold**" markers read as garbage in a plain-text clamp. */
function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\n{2,}/g, ' — ')
    .replace(/\n/g, ' ')
    .trim();
}

/** Signature element (per DESIGN_SYSTEM.md): kind-badge pills inline in each row. */
function KindBadge({ icon: Icon, count, label }: { icon: typeof Layers; count: number; label: string }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 mono text-[10px] tracking-[0.08em] text-white/50">
      <Icon className="h-2.5 w-2.5 text-mint-400/80" />
      {count} {label}
    </span>
  );
}

function HistoryRow({ item, index }: { item: Item; index: number }) {
  const preview = useMemo(() => stripMarkdown(item.summary).slice(0, 220), [item.summary]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.03, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/results/${item.id}`}
        className="group flex items-start gap-4 px-4 py-4 md:px-5 transition-colors duration-150 hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500/40 focus-visible:ring-inset cursor-pointer"
      >
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-white/[0.07] bg-white/[0.02] transition-colors duration-150 group-hover:border-mint-500/30 group-hover:bg-mint-500/[0.06]">
          <FileText className="h-4 w-4 text-white/55 transition-colors duration-150 group-hover:text-mint-400" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="truncate text-[14.5px] font-medium text-white">{item.file.filename}</div>
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-white/25 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-mint-400" />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 mono text-[10.5px] tracking-[0.06em] text-white/40">
            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
            <span className="text-white/15">·</span>
            <span>{item.file.pageCount ?? '?'} pages</span>
            <span className="text-white/15">·</span>
            <span>{formatBytes(item.file.sizeBytes)}</span>
          </div>

          {preview && (
            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-white/45">{preview}</p>
          )}

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <KindBadge icon={Layers} count={item.flashcards?.length ?? 0} label="CARDS" />
            <KindBadge icon={HelpCircle} count={item.examQuestions?.length ?? 0} label="QUIZ" />
            <KindBadge icon={Library} count={item.definitions?.length ?? 0} label="DEFS" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function HistoryInner() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get(`/history?page=1&pageSize=${PAGE_SIZE}`)
      .then((d) => { setItems(d.items); setTotal(d.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const d = await api.get(`/history?page=${next}&pageSize=${PAGE_SIZE}`);
      setItems((prev) => [...prev, ...d.items]);
      setTotal(d.total);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.file.filename.toLowerCase().includes(q));
  }, [items, query]);

  const hasMore = items.length < total;

  return (
    <div className="mx-auto max-w-4xl px-5 md:px-6 py-12 md:py-16">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mono text-[10.5px] text-mint-400 tracking-[0.22em] uppercase">// history</div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] md:text-[40px] font-semibold tracking-[-0.025em] leading-[1.05] text-white">
              All study packs
            </h1>
            <p className="mt-2 text-[13.5px] text-white/50">
              {total} {total === 1 ? 'pack' : 'packs'} in your archive.
            </p>
          </div>

          {/* Search — filename filter over loaded rows */}
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-white/35" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by filename…"
              aria-label="Filter packs by filename"
              className="h-9 w-56 rounded-[6px] border border-white/[0.07] bg-white/[0.02] pl-9 pr-3 text-[13px] text-white placeholder:text-white/30 transition-colors duration-150 focus:border-mint-500/40 focus:bg-white/[0.04] focus:outline-none"
            />
          </label>
        </div>
      </motion.div>

      {loading ? (
        <div className="mt-8 overflow-hidden rounded-xl border border-white/[0.06]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn('h-[104px] bg-white/[0.02] animate-pulse', i > 0 && 'border-t border-white/[0.05]')} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.015] px-8 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            <Sparkles className="h-6 w-6 text-mint-400" />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-white">No packs yet</h3>
          <p className="mt-1 text-sm text-white/50">Upload your first document to start your library.</p>
          <Link href="/upload" className="mt-6 inline-block"><MotionButton>Upload a file</MotionButton></Link>
        </div>
      ) : (
        <>
          <div className="mt-8 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.05]">
            {filtered.map((r, i) => (
              <HistoryRow key={r.id} item={r} index={i} />
            ))}
            {filtered.length === 0 && (
              <div className="px-5 py-12 text-center mono text-[12px] text-white/40">
                no packs match “{query}”
              </div>
            )}
          </div>

          {hasMore && !query && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-[13px] text-white/70 transition-colors duration-150 hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500/40 disabled:opacity-50 cursor-pointer"
              >
                {loadingMore
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</>
                  : <>Load more · {total - items.length} remaining</>}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return <Protected><HistoryInner /></Protected>;
}
