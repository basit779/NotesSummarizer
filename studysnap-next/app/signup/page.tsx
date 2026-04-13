'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { useAuth } from '@/lib/client/auth';

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(name, email, password);
      toast.success('Account created — welcome');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.message ?? 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-120px)] items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="mb-6 text-center">
          <div className="mono text-xs text-mint-400">// create account</div>
          <h1 className="mt-2 mono text-3xl font-semibold tracking-tightest text-white">Start studying smarter</h1>
          <p className="mt-2 text-sm text-white/50">3 free AI-powered packs every day. No card required.</p>
        </div>
        <GlassCard className="!p-8">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="mono text-xs text-white/60">NAME</Label>
              <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="mono text-xs text-white/60">EMAIL</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="mono text-xs text-white/60">PASSWORD</Label>
              <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              <p className="mono text-[11px] text-white/40">At least 8 characters.</p>
            </div>
            <MotionButton type="submit" className="w-full" loading={loading}>
              {loading ? 'Creating…' : <>Create account <ArrowRight className="h-4 w-4" /></>}
            </MotionButton>
          </form>
          <p className="mt-6 text-center text-sm text-white/50">
            Have an account?{' '}
            <Link href="/login" className="text-mint-400 hover:text-mint-300 transition-colors cursor-pointer">Sign in</Link>
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}
