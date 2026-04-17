'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight, Mail, Lock, User, Sparkles, Check } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { MotionButton } from '@/components/ui/MotionButton';
import { useAuth } from '@/lib/client/auth';

const PERKS = [
  '10 free PDFs every day',
  'Markdown-structured notes + flashcards',
  'Grounded AI chat per pack',
];

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
          <div className="mt-5 mono text-[11px] text-mint-400 tracking-widest">// create account</div>
          <h1 className="mt-2 mono text-[30px] font-semibold tracking-tightest text-white">Start studying smarter</h1>
          <p className="mt-2 text-[13.5px] text-white/50">Free forever. No card required.</p>
        </div>

        <div className="relative rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-white/[0.01] backdrop-blur-xl p-7 md:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="mono text-[10.5px] text-white/55 tracking-widest flex items-center gap-1.5">
                <User className="h-3 w-3" /> NAME
              </Label>
              <Input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                placeholder="Your name"
              />
            </div>
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
              <Label htmlFor="password" className="mono text-[10.5px] text-white/55 tracking-widest flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> PASSWORD
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="min. 8 characters"
              />
            </div>
            <MotionButton type="submit" className="w-full" loading={loading}>
              {loading ? 'Creating…' : <>Create account <ArrowRight className="h-4 w-4" /></>}
            </MotionButton>
          </form>

          <div className="mt-6 pt-6 border-t border-white/[0.05] space-y-2">
            {PERKS.map((p) => (
              <div key={p} className="flex items-center gap-2 text-[12.5px] text-white/55">
                <Check className="h-3.5 w-3.5 text-mint-400 shrink-0" />
                <span>{p}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-[13.5px] text-white/55">
            Have an account?{' '}
            <Link href="/login" className="text-mint-400 hover:text-mint-300 transition-colors cursor-pointer font-medium">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
