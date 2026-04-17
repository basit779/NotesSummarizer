'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight, Mail, Lock, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { MotionButton } from '@/components/ui/MotionButton';
import { useAuth } from '@/lib/client/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-120px)] flex items-center justify-center px-5 py-12 overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-mint-500/[0.08] blur-[120px]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-mint-500/25 bg-gradient-to-b from-mint-500/[0.12] to-mint-500/[0.03] shadow-[0_0_30px_-8px_rgba(16,185,129,0.6)]">
            <Sparkles className="h-5 w-5 text-mint-400" />
          </div>
          <div className="mt-5 mono text-[11px] text-mint-400 tracking-widest">// sign in</div>
          <h1 className="mt-2 mono text-[30px] font-semibold tracking-tightest text-white">Welcome back</h1>
          <p className="mt-2 text-[13.5px] text-white/50">Pick up where you left off.</p>
        </div>

        <div className="relative rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-white/[0.01] backdrop-blur-xl p-7 md:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="mono text-[10.5px] text-white/55 tracking-widest flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> EMAIL
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@school.edu"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="mono text-[10.5px] text-white/55 tracking-widest flex items-center gap-1.5">
                  <Lock className="h-3 w-3" /> PASSWORD
                </Label>
                <Link href="/forgot-password" className="mono text-[10.5px] text-white/40 hover:text-mint-400 transition-colors cursor-pointer">
                  forgot?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            <MotionButton type="submit" className="w-full" loading={loading}>
              {loading ? 'Signing in…' : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </MotionButton>
          </form>
          <p className="mt-7 text-center text-[13.5px] text-white/55">
            No account?{' '}
            <Link href="/signup" className="text-mint-400 hover:text-mint-300 transition-colors cursor-pointer font-medium">
              Create one — it's free
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center mono text-[10.5px] text-white/25">
          10 free PDFs / day · no card required
        </p>
      </motion.div>
    </div>
  );
}
