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
  { icon: Brain,    label: 'Structured notes', hint: 'Real markdown with headings, bullets, examples.' },
  { icon: Sparkles, label: 'Flashcards',       hint: '22-40 cards per pack. CSV export (Pro).' },
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

      if (uploaded.deduped) {
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
    <div className="mx-auto max-w-3xl px-5 md:px-6 py-10 md:py-16">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
        <div className="mono text-[11px] text-mint-400 tracking-widest">// new pack</div>
        <h1 className="mt-2 mono text-[36px] md:text-[48px] leading-[1.05] font-semibold tracking-tightest text-white text-balance">
          Drop PDFs. <span className="text-white/40">Get notes.</span>
        </h1>
        <p className="mt-3 text-white/55 text-[15px]">
          Up to {MAX_FILES} PDFs per pack · structured notes, flashcards, quiz, chat · ~20-40s.
        </p>
      </motion.div>

      {/* Dropzone */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="mt-10"
      >
        {canAddMore && (
          <motion.div
            {...(getRootProps() as any)}
            animate={{ scale: isDragActive ? 1.01 : 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`relative cursor-pointer rounded-3xl border-2 border-dashed ${isDragActive
                ? 'border-mint-500/50 bg-mint-500/[0.05]'
                : 'border-white/[0.10] bg-gradient-to-b from-white/[0.02] to-transparent hover:border-white/[0.18] hover:bg-white/[0.025]'
              } px-6 ${files.length === 0 ? 'py-16' : 'py-10'} text-center overflow-hidden transition-colors`}
          >
            <AnimatePresence>
              {isDragActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0"
                  style={{ boxShadow: 'inset 0 0 60px rgba(16,185,129,0.3)' }}
                />
              )}
            </AnimatePresence>
            <div className="absolute inset-x-0 -top-20 h-40 bg-gradient-to-b from-mint-500/[0.06] to-transparent blur-2xl" aria-hidden />
            <input {...getInputProps()} />
            <motion.div animate={{ y: isDragActive ? -4 : 0 }} className="relative">
              <div className={`mx-auto flex ${files.length === 0 ? 'h-16 w-16' : 'h-12 w-12'} items-center justify-center rounded-2xl border border-mint-500/25 bg-gradient-to-b from-mint-500/[0.12] to-mint-500/[0.03] transition-all`}>
                {files.length === 0 ? (
                  <UploadCloud className={`h-7 w-7 transition-colors ${isDragActive ? 'text-mint-400' : 'text-white/60'}`} />
                ) : (
                  <Plus className={`h-5 w-5 transition-colors ${isDragActive ? 'text-mint-400' : 'text-white/60'}`} />
                )}
              </div>
              {files.length === 0 ? (
                <>
                  <div className="mt-6 text-[17px] font-medium text-white">
                    {isDragActive ? 'Release to upload' : 'Drop your PDFs here'}
                  </div>
                  <div className="mt-1 text-[13px] text-white/45">or click to browse · up to {MAX_FILES} files · PDF · max 15 MB each</div>
                </>
              ) : (
                <>
                  <div className="mt-3 text-[14px] font-medium text-white">
                    {isDragActive ? 'Release to add' : `Add another PDF (${files.length}/${MAX_FILES})`}
                  </div>
                  <div className="mt-0.5 text-[12px] text-white/40">Mixing multiple PDFs creates one unified study pack</div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* File list */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 space-y-2"
            >
              {files.map((file, i) => (
                <motion.div
                  key={`${file.name}-${file.size}`}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-transparent p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-mint-500/25 bg-mint-500/[0.08]">
                        <FileText className="h-4.5 w-4.5 text-mint-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14.5px] font-medium text-white">{file.name}</div>
                        <div className="mono text-[11px] text-white/40">
                          {(file.size / 1024 / 1024).toFixed(2)} MB · file {i + 1}/{files.length}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      disabled={stage !== 'idle'}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-40"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4">
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
                  : <>Generate study pack from {files.length} PDF{files.length > 1 ? 's' : ''} <ArrowRight className="h-4 w-4" /></>)
                : stage === 'uploading'
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                  : <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing with AI…</>}
          </MotionButton>
        </div>

        {/* Processing skeleton */}
        <AnimatePresence>
          {stage === 'processing' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4"
            >
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-mint-500/10 border border-mint-500/25">
                    <Sparkles className="h-3.5 w-3.5 text-mint-400 animate-pulse" />
                  </div>
                  <div className="mono text-[11px] text-white/60 tracking-widest">
                    {files.length > 1 ? `READING ${files.length} PDFs IN PARALLEL` : 'AI IS READING YOUR PDF'}
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[95, 78, 62, 86, 54].map((w, i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15 }}
                      className="h-2.5 rounded-full bg-white/[0.06]"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Benefit row */}
      {stage === 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {BENEFITS.map((b) => (
            <div
              key={b.label}
              className="rounded-2xl border border-white/[0.05] bg-gradient-to-b from-white/[0.015] to-transparent p-4 flex items-start gap-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-mint-500/20 bg-mint-500/[0.06]">
                <b.icon className="h-4 w-4 text-mint-400" />
              </div>
              <div>
                <div className="text-[13.5px] font-medium text-white">{b.label}</div>
                <div className="mt-0.5 text-[12px] text-white/45 leading-relaxed">{b.hint}</div>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

export default function UploadPage() {
  return <Protected><UploadInner /></Protected>;
}
