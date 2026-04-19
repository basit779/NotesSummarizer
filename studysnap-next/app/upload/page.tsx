'use client';

import { useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { UploadCloud, FileText, X, ArrowRight, Loader2, Sparkles, Zap, Brain, Plus, Clock } from 'lucide-react';
import { api } from '@/lib/client/api';
import { Protected } from '@/components/Protected';
import { MotionButton } from '@/components/ui/MotionButton';
import { useCooldown } from '@/lib/client/useCooldown';
import { cn } from '@/lib/utils';

type Stage = 'idle' | 'uploading' | 'processing';

const MAX_FILES = 3;

const BENEFITS = [
  { icon: Brain,    label: 'Structured notes', hint: 'Markdown with headings, bullets, examples.' },
  { icon: Sparkles, label: 'Flashcards',       hint: '22–40 cards per pack. CSV export on Pro.' },
  { icon: Zap,      label: 'Quiz questions',   hint: 'MCQs with explained answers.' },
];

function UploadInner() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [stage, setStage] = useState<Stage>('idle');
  const lockRef = useRef(false);
  const cooldown = useCooldown();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: MAX_FILES,
    maxSize: 15 * 1024 * 1024,
    onDrop: (accepted, rejected) => {
      if (rejected.length > 0) {
        toast.error(rejected[0].errors[0]?.message ?? 'File rejected');
      }
      if (accepted.length > 0) {
        setFiles((prev) => {
          const next = [...prev];
          for (const f of accepted) {
            if (next.length >= MAX_FILES) {
              toast.error(`Max ${MAX_FILES} files per pack`);
              break;
            }
            if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
            next.push(f);
          }
          return next;
        });
      }
    },
    disabled: stage !== 'idle',
  });

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  async function handleStart() {
    if (files.length === 0 || stage !== 'idle' || lockRef.current || cooldown.active) {
      console.log('[UPLOAD] blocked duplicate submit', { stage, locked: lockRef.current, cooldown: cooldown.active });
      return;
    }
    lockRef.current = true;

    try {
      setStage('uploading');
      const form = new FormData();
      for (const f of files) form.append('files', f);
      const uploaded = await api.postForm('/upload', form);

      if (uploaded.cacheSource === 'cross-user') {
        toast.success('⚡ Instant result (cached)');
      } else if (uploaded.deduped) {
        toast.success('Already processed — loading cached pack.');
      } else {
        setStage('processing');
        toast.info(files.length > 1 ? `Analyzing ${files.length} PDFs — ~20-40s` : 'Analyzing with AI — ~15-30s');
      }
      const processed = await api.post(`/process/${uploaded.file.id}`, {});
      if (processed.chunks && processed.chunks > 1) {
        toast.info(`Big document — processed in ${processed.chunks} parallel chunks for full coverage.`);
      } else if (processed.truncated) {
        toast.info('Large PDF detected — we analyzed the key sections for best coverage.');
      }
      if (processed.degraded) {
        toast.warning('Notes ready. Flashcards, quiz, study tips, and connections took too long — refresh to retry.', { duration: 8000 });
      }
      toast.success('Study pack ready');
      router.push(`/results/${processed.result.id}`);
    } catch (err: any) {
      const retryAfter = err?.details?.retryAfterSeconds as number | undefined;
      if (err?.code === 'FREE_LIMIT_REACHED') {
        toast.error(err.message, { action: { label: 'Upgrade', onClick: () => router.push('/billing') } });
      } else if (err?.code === 'COOLDOWN_ACTIVE') {
        if (retryAfter) cooldown.start(retryAfter);
        toast.info(err.message ?? 'Please wait.', { duration: Math.min(6000, (retryAfter ?? 5) * 1000) });
      } else if (err?.code === 'ALREADY_PROCESSING') {
        toast.info('Already processing — hold on…');
      } else if (err?.code === 'UPLOAD_COOLDOWN') {
        toast.info(err.message ?? 'Please wait a moment before uploading again.');
      } else if (err?.code === 'ALL_RATE_LIMITED') {
        toast.error('AI providers are busy. Wait ~1 minute, then try again.', { duration: 8000 });
        cooldown.start(60);
      } else {
        toast.error(err?.message ?? 'Something went wrong');
      }
      setStage('idle');
    } finally {
      lockRef.current = false;
    }
  }

  const canAddMore = files.length < MAX_FILES && stage === 'idle';

  return (
    <div className="mx-auto max-w-xl px-6 py-16 md:py-24">
      {/* Hero */}
      <div>
        <div className="mono text-[11px] text-white/45 uppercase tracking-[0.15em]">
          New pack
        </div>
        <h1 className="mt-3 text-[32px] md:text-[38px] leading-[1.1] font-semibold tracking-[-0.02em] text-white">
          Upload PDFs. Get notes.
        </h1>
        <p className="mt-3 text-[14.5px] text-white/55 leading-relaxed">
          Up to {MAX_FILES} PDFs per pack. Structured notes, flashcards, quiz, and a chat tutor.
        </p>
      </div>

      {/* Dropzone */}
      <div className="mt-8">
        {canAddMore && (
          <div
            {...(getRootProps() as any)}
            className={cn(
              'relative rounded-xl border cursor-pointer px-6 py-10 transition-colors duration-150',
              isDragActive
                ? 'border-white/20 bg-white/[0.03]'
                : 'border-white/[0.08] bg-white/[0.01] hover:border-white/[0.14] hover:bg-white/[0.02]',
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02]">
                {files.length === 0 ? (
                  <UploadCloud className="h-5 w-5 text-white/55" />
                ) : (
                  <Plus className="h-4 w-4 text-white/55" />
                )}
              </div>
              <div>
                <div className="text-[14.5px] font-medium text-white">
                  {isDragActive
                    ? 'Release to upload'
                    : files.length === 0
                      ? 'Drop PDFs or click to browse'
                      : 'Add another PDF'}
                </div>
                <div className="mt-1 mono text-[11px] text-white/40">
                  {files.length === 0
                    ? `PDF · max 15 MB · up to ${MAX_FILES} files`
                    : `${files.length}/${MAX_FILES} selected`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            <AnimatePresence initial={false}>
              {files.map((file, i) => (
                <motion.div
                  key={`${file.name}-${file.size}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.10] transition-colors duration-150 px-3 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
                      <FileText className="h-4 w-4 text-white/55" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium text-white">{file.name}</div>
                      <div className="mono text-[11px] text-white/40">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    disabled={stage !== 'idle'}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer disabled:opacity-40"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Primary CTA — the one mint moment */}
        <div className="mt-6">
          <MotionButton
            size="lg"
            className="w-full !rounded-[4px]"
            disabled={files.length === 0 || stage !== 'idle' || cooldown.active}
            onClick={handleStart}
          >
            {cooldown.active
              ? <><Clock className="h-4 w-4" /> Wait {cooldown.secondsLeft}s</>
              : stage === 'idle'
                ? (files.length === 0
                  ? <>Generate study pack <ArrowRight className="h-4 w-4" /></>
                  : <>Generate from {files.length} PDF{files.length > 1 ? 's' : ''} <ArrowRight className="h-4 w-4" /></>)
                : stage === 'uploading'
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                  : <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>}
          </MotionButton>
        </div>

        {/* Processing card — real state change */}
        <AnimatePresence>
          {stage === 'processing' && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-4"
            >
              <div className="flex items-center justify-between mono text-[11px] text-white/60 uppercase tracking-[0.12em]">
                <span>{files.length > 1 ? `Reading ${files.length} PDFs` : 'Reading your PDF'}</span>
                <span className="text-white/30">~15–40s</span>
              </div>
              <div className="mt-3 h-[2px] w-full rounded-full bg-white/[0.06] overflow-hidden relative">
                <motion.div
                  className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-mint-400 to-transparent"
                  animate={{ x: ['-100%', '300%'] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Benefits */}
      {stage === 'idle' && (
        <div className="mt-12 border-t border-white/[0.06] pt-6">
          <div className="mono text-[11px] text-white/40 uppercase tracking-[0.15em] mb-4">
            What you get
          </div>
          <div className="space-y-2">
            {BENEFITS.map((b) => (
              <div key={b.label} className="flex items-start gap-3 py-1 text-[13.5px]">
                <b.icon className="h-4 w-4 text-white/45 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-white/85">{b.label}</span>
                  <span className="text-white/25 mx-2">·</span>
                  <span className="text-white/50">{b.hint}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  return <Protected><UploadInner /></Protected>;
}
