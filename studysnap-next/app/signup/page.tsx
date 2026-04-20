'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
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
    <div className="flex min-h-[calc(100vh-120px)] items-center justify-center px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        {/* Brand mark tile */}
        <Link
          href="/"
          aria-label="StudySnap home"
          className="mx-auto mb-8 flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] transition-colors duration-150 hover:bg-white/[0.04]"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
            <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.2" className="text-white/30" fill="none" />
            <line x1="6" y1="7"  x2="14" y2="7"  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-white/35" />
            <line x1="6" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-mint-400" />
            <line x1="6" y1="15" x2="11" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-white/25" />
          </svg>
        </Link>

        <div className="mb-8 text-center">
          <h1 className="text-[30px] font-semibold tracking-[-0.025em] leading-[1.1] text-white">
            Create your account
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">
            Free forever. No credit card required.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.015] p-6"
        >
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[12px] font-medium text-white/65">
              Name
            </Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              placeholder="Your name"
              className="!rounded-[6px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[12px] font-medium text-white/65">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@school.edu"
              className="!rounded-[6px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[12px] font-medium text-white/65">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="!rounded-[6px]"
            />
          </div>

          <MotionButton
            type="submit"
            className="w-full !rounded-[6px]"
            loading={loading}
          >
            {loading ? 'Creating…' : (
              <>
                Create account
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </MotionButton>
        </form>

        <p className="mt-6 text-center text-[13px] text-white/55">
          Have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-white transition-colors duration-150 hover:text-mint-400"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center mono text-[10.5px] uppercase tracking-[0.15em] text-white/25">
          10 free PDFs daily · Cancel anytime
        </p>
      </motion.div>
    </div>
  );
}
