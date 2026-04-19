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

type Stage = 'idle' | 'uploading' | 'processing';

const MAX_FILES = 3;

const BENEFITS = [
  { icon: Brain,    label: 'Structured notes', hint: 'Markdown with headings, bullets, examples.' },
  { icon: Sparkles, label: 'Flashcards',       hint: '22–40 cards. CSV export on Pro.' },
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
    <div className="mx-auto max-w-2xl px-5 md:px-6 py-12 md:py-20">
      {/* Hero — Geist Sans headline, mono eyebrow */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mono text-[11px] text-mint-400/90 tracking-[0.18em] uppercase">
          <span className="inline-block h-1 w-1 rounded-full bg-mint-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
          new pack
        </div>
        <h1 className="mt-3 text-[34px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.02em] text-white">
          Drop PDFs.
          <span className="block text-white/40">Get notes.</span>
        </h1>
        <p className="mt-3 text-[14.5px] text-white/55 leading-relaxed">
          Up to {MAX_FILES} PDFs per pack · structured notes, flashcards, quiz, chat tutor.
        </p>
      </motion.div>

      {/* Dropzone */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.06 }}
        className="mt-8"
      >
        {canAddMore && (
          <div
            {...(getRootProps() as any)}
            className={`group relative cursor-pointer rounded-xl border border-dashed px-5 ${files.length === 0 ? 'py-14' : 'py-8'} text-center overflow-hidden transition-[border-color,background-color] duration-150 ${
              isDragActive
                ? 'border-mint-500/50 bg-mint-500/[0.035]'
                : 'border-white/[0.08] hover:border-white/[0.14] bg-white/[0.012] hover:bg-white/[0.02]'
            }`}
          >
            {/* top hairline: mint → transparent; intensifies on dragActive */}
            <div
              className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-mint-400 to-transparent transition-opacity duration-[180ms] ${
                isDragActive ? 'opacity-75' : 'opacity-35'
              }`}
              aria-hidden
            />

            <input {...getInputProps()} />
            <div className="relative">
              <div
                className={`mx-auto flex ${files.length === 0 ? 'h-11 w-11' : 'h-9 w-9'} items-center justify-center rounded-[10px] border bg-white/[0.02] transition-colors duration-150 ${
                  isDragActive ? 'border-mint-500/40 bg-mint-500/[0.06]' : 'border-white/[0.06]'
                }`}
              >
                {files.length === 0 ? (
                  <UploadCloud className={`h-[18px] w-[18px] transition-colors duration-150 ${isDragActive ? 'text-mint-400' : 'text-white/55'}`} />
                ) : (
                  <Plus className={`h-4 w-4 transition-colors duration-150 ${isDragActive ? 'text-mint-400' : 'text-white/55'}`} />
                )}
              </div>
              {files.length === 0 ? (
                <>
                  <div className="mt-5 text-[14.5px] font-medium text-white">
                    {isDragActive ? 'Release to upload' : 'Drop PDFs here'}
                  </div>
                  <div className="mt-1.5 mono text-[11px] text-white/40 tracking-wide">
                    click to browse · pdf · max 15 MB · up to {MAX_FILES}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-3 text-[13.5px] font-medium text-white">
                    {isDragActive ? 'Release to add' : 'Add another PDF'}
                  </div>
                  <div className="mt-1 mono text-[11px] text-white/40">
                    {files.length}/{MAX_FILES} · mixed into one pack
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* File list — precision rows with mint left-rail */}
        <AnimatePresence initial={false}>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="mt-3 space-y-2"
            >
              {files.map((file, i) => (
                <motion.div
                  key={`${file.name}-${file.size}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="relative overflow-hidden rounded-xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.08] transition-colors duration-150"
                >
                  <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r bg-mint-400/80" aria-hidden />
                  <div className="flex items-center justify-between gap-3 pl-4 pr-2 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-white/[0.06] bg-white/[0.02]">
                        <FileText className="h-[14px] w-[14px] text-white/55" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-medium text-white">{file.name}</div>
                        <div className="mono text-[11px] text-white/40">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                          <span className="text-white/20 mx-1.5">·</span>
                          <span>{i + 1}/{files.length}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      disabled={stage !== 'idle'}
                      className="flex h-8 w-8 items-center justify-center rounded-[8px] text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer disabled:opacity-40"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-[14px] w-[14px]" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary CTA */}
        <div className="mt-5">
          <MotionButton
            size="lg"
            className="w-full"
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
                  : <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing with AI…</>}
          </MotionButton>
        </div>

        {/* Processing — single thin indeterminate bar + mono phase label */}
        <AnimatePresence>
          {stage === 'processing' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 rounded-xl border border-white/[0.04] bg-white/[0.015] px-4 py-4"
            >
              <div className="flex items-center justify-between mono text-[11px] text-white/55 tracking-wide">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-mint-400" />
                  <span>{files.length > 1 ? `// reading ${files.length} pdfs in parallel` : '// reading your pdf'}</span>
                </div>
                <span className="text-white/35">~15–40s</span>
              </div>
              <div className="mt-3 h-[2px] w-full rounded-full bg-white/[0.04] overflow-hidden relative">
                <motion.div
                  className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-mint-400 to-transparent"
                  animate={{ x: ['-100%', '300%'] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Benefits — precision rows, no card chrome */}
      {stage === 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.14 }}
          className="mt-10 border-t border-white/[0.04] pt-6"
        >
          <div className="mono text-[10px] text-white/35 tracking-[0.16em] uppercase mb-3">
            what you get
          </div>
          <div className="space-y-1">
            {BENEFITS.map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-3 py-1.5 text-[13.5px]"
              >
                <b.icon className="h-[14px] w-[14px] text-mint-400/80 shrink-0" />
                <span className="text-white/80 shrink-0">{b.label}</span>
                <span className="text-white/20">·</span>
                <span className="mono text-[11.5px] text-white/40 truncate">{b.hint}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function UploadPage() {
  return <Protected><UploadInner /></Protected>;
}
