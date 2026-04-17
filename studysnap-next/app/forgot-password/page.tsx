'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Copy, ArrowRight, Mail, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { api } from '@/lib/client/api';

type ResultState =
  | { kind: 'sent'; email: string }
  | { kind: 'dev'; resetUrl: string }
  | null;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultState>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.post('/auth/request-reset', { email });
      if (data.emailSent) {
        setResult({ kind: 'sent', email });
      } else if (data.resetUrl) {
        setResult({ kind: 'dev', resetUrl: data.resetUrl });
      } else {
        // Prod + email delivery failed — generic confirmation so we don't leak user existence.
        setResult({ kind: 'sent', email });
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  }

  return (
    <div className="flex min-h-[calc(100vh-120px)] items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="mb-6 text-center">
          <div className="mono text-xs text-mint-400">// forgot password</div>
          <h1 className="mt-2 mono text-3xl font-semibold tracking-tightest text-white">Reset your password</h1>
          <p className="mt-2 text-sm text-white/50">Enter your email to get a reset link.</p>
        </div>
        <GlassCard className="!p-8">
          {!result ? (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="mono text-xs text-white/60">EMAIL</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <MotionButton type="submit" className="w-full" loading={loading}>
                {loading ? 'Sending…' : <>Send reset link <ArrowRight className="h-4 w-4" /></>}
              </MotionButton>
            </form>
          ) : result.kind === 'sent' ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint-500/15 border border-mint-500/30">
                <CheckCircle2 className="h-6 w-6 text-mint-400" />
              </div>
              <div>
                <h2 className="mono text-lg font-semibold text-white">Check your inbox</h2>
                <p className="mt-2 text-sm text-white/60">
                  If an account exists for <span className="text-white/90">{result.email}</span>, we just sent a reset link.
                </p>
                <p className="mt-2 text-xs text-white/40">The link expires in 15 minutes. Check spam if you don't see it.</p>
              </div>
              <MotionButton variant="outline" size="sm" className="w-full" onClick={() => setResult(null)}>
                <Mail className="h-3.5 w-3.5" /> Use a different email
              </MotionButton>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/[0.08] p-3 text-[12px] text-yellow-300/90 leading-relaxed">
                <strong className="mono">DEV MODE:</strong> email delivery isn't configured (<code className="font-mono">RESEND_API_KEY</code> not set). Use the link below to continue. In production this would be emailed.
              </div>
              <div className="mono text-xs text-mint-400">// reset link (valid 15 min)</div>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 font-mono text-[11px] text-white/80 break-all">
                {result.resetUrl}
              </div>
              <div className="flex gap-2">
                <MotionButton variant="outline" size="sm" onClick={() => copy(result.resetUrl)} className="flex-1">
                  <Copy className="h-3.5 w-3.5" /> Copy link
                </MotionButton>
                <Link href={result.resetUrl.replace(/^https?:\/\/[^/]+/, '')} className="flex-1">
                  <MotionButton size="sm" className="w-full">Open</MotionButton>
                </Link>
              </div>
            </div>
          )}
          <p className="mt-6 text-center text-sm text-white/50">
            <Link href="/login" className="text-mint-400 hover:text-mint-300 transition-colors cursor-pointer">Back to sign in</Link>
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}
