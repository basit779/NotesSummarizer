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
import { StudySnapLogo } from '@/components/brand/StudySnapLogo';
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
          className="mx-auto mb-8 flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.08] bg-black/[0.02] transition-colors duration-150 hover:bg-black/[0.05]"
        >
          <StudySnapLogo size={20} color="#000" cutoutColor="#fff" />
        </Link>

        <div className="mb-8 text-center">
          <h1 className="text-[30px] font-semibold tracking-[-0.025em] leading-[1.1] text-black">
            Create your account
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-black/55">
            Free forever. No credit card required.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-black/[0.08] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[12px] font-medium text-black/65">
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[12px] font-medium text-black/65">
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[12px] font-medium text-black/65">
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
            />
          </div>

          <MotionButton
            type="submit"
            className="w-full"
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

        <p className="mt-6 text-center text-[13px] text-black/55">
          Have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-black transition-colors duration-150 hover:text-black/70"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center text-[12px] uppercase tracking-wide text-black/30">
          10 free PDFs daily · Cancel anytime
        </p>
      </motion.div>
    </div>
  );
}
