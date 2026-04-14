'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/client/auth';

/** Keeps Neon DB warm by pinging /api/health every 4 minutes while a user is logged in. */
export function KeepAlive() {
  const user = useAuth((s) => s.user);
  useEffect(() => {
    if (!user) return;
    const tick = () => fetch('/api/health').catch(() => {});
    tick();
    const id = setInterval(tick, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);
  return null;
}
