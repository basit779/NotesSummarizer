'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/client/auth';

export function AuthInit() {
  const init = useAuth((s) => s.init);
  useEffect(() => { init(); }, [init]);
  return null;
}
