'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/client/auth';

export function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) return <div className="mx-auto max-w-6xl px-6 py-20 text-center text-white/40 mono text-sm">loading…</div>;
  if (!user) return null;
  return <>{children}</>;
}
