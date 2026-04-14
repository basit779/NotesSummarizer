'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { UploadCloud, FileText, X, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/client/api';
import { Protected } from '@/components/Protected';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { ModelPicker, ModelId } from '@/components/ModelPicker';

type Stage = 'idle' | 'uploading' | 'processing';

function UploadInner() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [model, setModel] = useState<ModelId>('auto');

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 15 * 1024 * 1024,
    onDrop: (accepted, rejected) => {
      if (rejected[0]) { toast.error(rejected[0].errors[0]?.message ?? 'File rejected'); return; }
      if (accepted[0]) setFile(accepted[0]);
    },
    disabled: stage !== 'idle',
  });

  async function handleStart() {
    if (!file || stage !== 'idle') return; // double-click guard
    try {
      setStage('uploading');
      const form = new FormData();
      form.append('file', file);
      const uploaded = await api.postForm('/upload', form);

      setStage('processing');
      toast.info('Running AI analysis — ~15-30s');
      const processed = await api.post(`/process/${uploaded.file.id}`, model === 'auto' ? {} : { model });
      toast.success('Study pack ready');
      router.push(`/results/${processed.result.id}`);
    } catch (err: any) {
      if (err?.code === 'FREE_LIMIT_REACHED') {
        toast.error(err.message, { action: { label: 'Upgrade', onClick: () => router.push('/billing') } });
      } else if (err?.code === 'ALREADY_PROCESSING') {
        toast.info('Already processing this file — hold on…');
      } else {
        toast.error(err?.message ?? 'Something went wrong');
      }
      setStage('idle');
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mono text-xs text-mint-400">// upload</div>
        <h1 className="mt-2 mono text-4xl font-semibold tracking-tightest text-white">New study pack</h1>
        <p className="mt-2 text-white/55">Drop a PDF. Pick a model. Get a study pack in seconds.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="mt-8 space-y-4">
        <motion.div
          {...(getRootProps() as any)}
          animate={{
            scale: isDragActive ? 1.015 : 1,
            borderColor: isDragActive ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative cursor-pointer rounded-2xl border-2 border-dashed bg-white/[0.02] px-6 py-14 text-center overflow-hidden"
        >
          <AnimatePresence>
            {isDragActive && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-mint-500/[0.08]"
                style={{ boxShadow: 'inset 0 0 40px rgba(16,185,129,0.25)' }}
              />
            )}
          </AnimatePresence>
          <input {...getInputProps()} />
          <motion.div animate={{ y: isDragActive ? -4 : 0 }} className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              <UploadCloud className={`h-6 w-6 transition-colors ${isDragActive ? 'text-mint-400' : 'text-white/60'}`} />
            </div>
            <div className="mt-5 font-medium text-white">
              {isDragActive ? 'Release to upload' : 'Drag & drop or click to browse'}
            </div>
            <div className="mono mt-1 text-[11px] text-white/40">PDF · max 15 MB</div>
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {file && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <GlassCard className="!p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-mint-500/20 bg-mint-500/[0.06]">
                    <FileText className="h-4 w-4 text-mint-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{file.name}</div>
                    <div className="mono text-[11px] text-white/40">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)} disabled={stage !== 'idle'}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-40"
                  aria-label="Remove file"
                ><X className="h-4 w-4" /></button>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        <ModelPicker value={model} onChange={setModel} disabled={stage !== 'idle'} />

        <MotionButton size="lg" className="w-full" disabled={!file || stage !== 'idle'} onClick={handleStart}>
          {stage === 'idle' && <>Generate study pack <ArrowRight className="h-4 w-4" /></>}
          {stage === 'uploading' && <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>}
          {stage === 'processing' && <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>}
        </MotionButton>

        <AnimatePresence>
          {stage === 'processing' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <GlassCard className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2 }}
                    className="h-3 rounded bg-white/[0.06]"
                    style={{ width: `${[95, 78, 60][i]}%` }}
                  />
                ))}
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default function UploadPage() {
  return <Protected><UploadInner /></Protected>;
}
