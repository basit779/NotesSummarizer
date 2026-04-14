'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { GlassCard } from '@/components/ui/GlassCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { api } from '@/lib/client/api';
import { useAuth } from '@/lib/client/auth';

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = params.get('token');
    if (t) setToken(t);
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.post('/auth/reset-password', { token, newPassword });
      localStorage.setItem('ss_token', data.token);
      localStorage.setItem('ss_user', JSON.stringify(data.user));
      useAuth.setState({ token: data.token, user: data.user });
      toast.success('Password updated — welcome back');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.message ?? 'Reset failed');
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
          <div className="mono text-xs text-mint-400">// reset password</div>
          <h1 className="mt-2 mono text-3xl font-semibold tracking-tightest text-white">Set a new password</h1>
          <p className="mt-2 text-sm text-white/50">Paste your reset token and pick a new password.</p>
        </div>
        <GlassCard className="!p-8">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="token" className="mono text-xs text-white/60">TOKEN</Label>
              <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="mono text-xs text-white/60">NEW PASSWORD</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </div>
            <MotionButton type="submit" className="w-full" loading={loading}>
              {loading ? 'Updating…' : <>Update password <ArrowRight className="h-4 w-4" /></>}
            </MotionButton>
          </form>
          <p className="mt-6 text-center text-sm text-white/50">
            Remembered it?{' '}
            <Link href="/login" className="text-mint-400 hover:text-mint-300 transition-colors cursor-pointer">Back to sign in</Link>
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}

export default function ResetPage() {
  return <Suspense fallback={null}><ResetInner /></Suspense>;
}
