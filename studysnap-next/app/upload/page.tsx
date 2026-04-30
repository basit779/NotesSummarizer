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
import { BlurFade } from '@/components/ui/BlurFade';
import { useCooldown } from '@/lib/client/useCooldown';
import { cn } from '@/lib/utils';
import { MouseGlow } from '@/components/ui/MouseGlow';

type Stage = 'idle' | 'uploading' | 'processing';

const MAX_FILES = 1;

/** Poll cadence + timeout. 3s × 60 = 3 min hard ceiling — generous against
 *  the 60s function cap + ~20s of pre-flight, with headroom for cold starts.
 *  After this, we surface an error rather than spinning forever. */
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 60;

async function pollUntilDone(fileId: string): Promise<{ id: string }> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await api.get(`/process/${fileId}/status`);
    if (res.status === 'done') return res.result;
    if (res.status === 'error') {
      const err: any = new Error(res.errorMessage || 'Generation failed');
      err.code = 'PROCESS_FAILED';
      throw err;
    }
    // status === 'processing' — keep polling
  }
  const timeoutErr: any = new Error('Generation took too long. Try again with a smaller document.');
  timeoutErr.code = 'POLL_TIMEOUT';
  throw timeoutErr;
}

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
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
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
      // Propagate ?fresh=1 through to the API so allowlisted test users can
      // force a regen bypassing PdfCache. Server enforces the allowlist; a
      // normal user hitting /upload?fresh=1 gets 403.
      const isFresh = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fresh') === '1';
      const uploaded = await api.postForm(isFresh ? '/upload?fresh=1' : '/upload', form);
      if (isFresh) toast.info('Fresh regen mode — bypassing cache');

      if (uploaded.cacheSource === 'cross-user') {
        toast.success('⚡ Instant result (cached)');
      } else if (uploaded.deduped) {
        toast.success('Already processed — loading cached pack.');
      } else {
        setStage('processing');
        toast.info(files.length > 1 ? `Analyzing ${files.length} PDFs — ~20-40s` : 'Analyzing with AI — ~15-30s');
      }
      // Kick off processing — returns 202 immediately with status='processing',
      // OR 200 with status='done' + result if it was a cache hit. The pipeline
      // runs detached on the server via waitUntil; we poll for completion.
      const kickoff = await api.post(`/process/${uploaded.file.id}`, {});
      const result = kickoff.status === 'done'
        ? kickoff.result
        : await pollUntilDone(uploaded.file.id);
      toast.success('Study pack ready');
      router.push(`/results/${result.id}`);
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
    <div className="min-h-screen relative overflow-hidden bg-ink-950 font-sans flex flex-col items-center">
      <MouseGlow />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-mint-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="mx-auto w-full max-w-3xl px-5 md:px-6 py-14 md:py-24 relative z-10 flex flex-col pt-32">
      <div>
        <BlurFade delay={0}>
          <div className="flex items-center gap-2.5 mono text-[10.5px] text-mint-400 tracking-[0.22em] uppercase">
            <span className="inline-block h-1 w-1 rounded-full bg-mint-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span>// New pack</span>
          </div>
        </BlurFade>
        <BlurFade delay={0.08}>
          <h1 className="mt-4 text-[36px] md:text-[46px] leading-[1.02] font-semibold tracking-[-0.025em] text-white">
            Drop PDFs.
            <span className="block text-white/35">Get notes.</span>
          </h1>
        </BlurFade>
        <BlurFade delay={0.16}>
          <p className="mt-4 text-[14.5px] text-white/55 leading-relaxed max-w-md">
            PDF, DOCX, PPTX, or XLSX · 1 file at a time · structured notes, flashcards, quiz, chat tutor.
          </p>
        </BlurFade>
      </div>

      {/* DROPZONE — harvested 21st.dev motion shell (border solidify + cloud bob + halo pulse), mint-swapped, wired to our useDropzone */}
      <BlurFade delay={0.24} className="mt-10">
        {canAddMore && (
          <motion.div
            {...(getRootProps() as any)}
            initial={false}
            animate={{
              borderColor: isDragActive ? 'rgba(16,185,129,0.85)' : 'rgba(255,255,255,0.06)',
              scale: isDragActive ? 1.012 : 1,
            }}
            whileHover={{ scale: 1.004 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative rounded-xl border overflow-hidden cursor-pointer bg-white/[0.012]',
              isDragActive && 'ring-4 ring-mint-500/25',
              files.length === 0 ? 'px-8 py-14' : 'px-8 py-10',
            )}
          >
            {/* top hairline mint→transparent — intensifies on drag */}
            <div
              className={cn(
                'pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-mint-400 to-transparent transition-opacity duration-200',
                isDragActive ? 'opacity-80' : 'opacity-30',
              )}
              aria-hidden
            />
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-5 text-center">
              {/* Cloud bob (outer) + halo pulse (absolute, only on drag) */}
              <motion.div
                animate={{ y: isDragActive ? [-3, 0, -3] : 0 }}
                transition={{ duration: 1.4, repeat: isDragActive ? Infinity : 0, ease: 'easeInOut' }}
                className="relative"
              >
                {isDragActive && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: [0.35, 0.65, 0.35], scale: [0.95, 1.08, 0.95] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -inset-3 rounded-full bg-mint-500/25 blur-lg"
                    aria-hidden
                  />
                )}
                <div
                  className={cn(
                    'relative flex h-14 w-14 items-center justify-center rounded-[10px] border transition-colors duration-200',
                    isDragActive ? 'border-mint-500/50 bg-mint-500/[0.08]' : 'border-white/[0.08] bg-white/[0.02]',
                  )}
                >
                  {files.length === 0 ? (
                    <UploadCloud
                      className={cn(
                        'h-6 w-6 transition-colors duration-200',
                        isDragActive ? 'text-mint-400' : 'text-white/60',
                      )}
                    />
                  ) : (
                    <Plus
                      className={cn(
                        'h-5 w-5 transition-colors duration-200',
                        isDragActive ? 'text-mint-400' : 'text-white/60',
                      )}
                    />
                  )}
                </div>
              </motion.div>

              <div className="space-y-1.5">
                <h3 className="text-[15px] font-medium text-white">
                  {isDragActive
                    ? 'Release to upload'
                    : 'Drop a file here, or click to browse'}
                </h3>
                <p className="mono text-[10.5px] text-white/40 tracking-[0.18em] uppercase">
                  PDF, DOCX, PPTX, XLSX · max 15 MB
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* File list — harvested spring entry (stiffness 300, damping 24) */}
        <AnimatePresence initial={false}>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between px-1 mono text-[10px] text-white/35 tracking-[0.2em] uppercase">
                <span>// Queued · {files.length}</span>
                {files.length > 1 && (
                  <button
                    onClick={() => setFiles([])}
                    disabled={stage !== 'idle'}
                    className="text-white/40 hover:text-white transition-colors duration-150 cursor-pointer disabled:opacity-40"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {files.map((file, i) => (
                <motion.div
                  key={`${file.name}-${file.size}`}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  className="relative overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.08] transition-colors duration-150"
                >
                  <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r bg-mint-400/80" aria-hidden />
                  <div className="flex items-center justify-between gap-3 pl-4 pr-2 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-white/[0.06] bg-white/[0.02]">
                        <FileText className="h-[15px] w-[15px] text-white/55" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium text-white">{file.name}</div>
                        <div className="mono text-[10.5px] text-white/40 tracking-[0.1em] uppercase">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                          <span className="text-white/15 mx-1.5">·</span>
                          <span>{i + 1}/{files.length}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      disabled={stage !== 'idle'}
                      className="flex h-8 w-8 items-center justify-center rounded-[6px] text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer disabled:opacity-40"
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

        {/* Primary CTA — sharp-cornered precision language (4px override) */}
        <div className="mt-5">
          <MotionButton
            size="lg"
            className="w-full !rounded-[6px]"
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

        {/* PROCESSING — mono phase label + single indeterminate sweep */}
        <AnimatePresence>
          {stage === 'processing' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-4"
            >
              <div className="flex items-center justify-between mono text-[10.5px] text-white/55 tracking-[0.16em] uppercase">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-mint-400" />
                  <span>{files.length > 1 ? `// Reading ${files.length} PDFs in parallel` : '// Reading your PDF'}</span>
                </div>
                <span className="text-white/30 tracking-[0.1em]">~15–40s</span>
              </div>
              <div className="mt-3 h-[2px] w-full rounded-full bg-white/[0.05] overflow-hidden relative">
                <motion.div
                  className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-mint-400 to-transparent"
                  animate={{ x: ['-100%', '300%'] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </BlurFade>

      {/* BENEFITS — editorial page-turn: hairline divider + mono section label */}
      {stage === 'idle' && (
        <BlurFade delay={0.36} className="mt-14">
          <div className="border-t border-white/[0.04] pt-6">
            <div className="mono text-[10px] text-white/35 tracking-[0.22em] uppercase mb-4">
              // What you get
            </div>
            <div className="space-y-1">
              {BENEFITS.map((b) => (
                <div key={b.label} className="flex items-center gap-3 py-1.5 text-[13.5px]">
                  <b.icon className="h-[14px] w-[14px] text-white/45 shrink-0" />
                  <span className="text-white/85 shrink-0">{b.label}</span>
                  <span className="text-white/15">·</span>
                  <span className="mono text-[11px] text-white/40 tracking-[0.05em] truncate">{b.hint}</span>
                </div>
              ))}
            </div>
          </div>
        </BlurFade>
      )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  return <Protected><UploadInner /></Protected>;
}
