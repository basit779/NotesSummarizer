'use client';

import { useEffect, useState } from 'react';

export interface CooldownState {
  active: boolean;
  secondsLeft: number;
  start: (seconds: number) => void;
  reset: () => void;
}

/**
 * Tracks a per-action cooldown window. Call start(seconds) when the server
 * returns COOLDOWN_ACTIVE; UI can read `active` to disable buttons and
 * `secondsLeft` for a countdown label. Ticks every 500ms for smooth display.
 */
export function useCooldown(): CooldownState {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (until === null) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= until) setUntil(null);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [until]);

  const active = until !== null && now < until;
  const secondsLeft = active ? Math.max(1, Math.ceil(((until ?? 0) - now) / 1000)) : 0;

  return {
    active,
    secondsLeft,
    start(seconds: number) {
      const safe = Math.max(1, Math.floor(seconds));
      setUntil(Date.now() + safe * 1000);
      setNow(Date.now());
    },
    reset() {
      setUntil(null);
    },
  };
}
