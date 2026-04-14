'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Copy, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { api } from '@/lib/client/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.post('/auth/request-reset', { email });
      if (data.resetUrl) {
        setResetUrl(data.resetUrl);
      } else {
        toast.success('If the email exists, a reset link was issued.');
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
          {!resetUrl ? (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="mono text-xs text-white/60">EMAIL</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <MotionButton type="submit" className="w-full" loading={loading}>
                {loading ? 'Generating…' : <>Send reset link <ArrowRight className="h-4 w-4" /></>}
              </MotionButton>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="mono text-xs text-mint-400">// reset link (valid 15 min)</div>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 font-mono text-[11px] text-white/80 break-all">
                {resetUrl}
              </div>
              <div className="flex gap-2">
                <MotionButton variant="outline" size="sm" onClick={() => copy(resetUrl)} className="flex-1">
                  <Copy className="h-3.5 w-3.5" /> Copy link
                </MotionButton>
                <Link href={resetUrl.replace(/^https?:\/\/[^/]+/, '')} className="flex-1">
                  <MotionButton size="sm" className="w-full">Open</MotionButton>
                </Link>
              </div>
              <p className="mono text-[11px] text-white/30 text-center">
                Email delivery coming soon — for now, copy & open the link.
              </p>
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
