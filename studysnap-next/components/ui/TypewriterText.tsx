'use client';

import { useEffect, useState } from 'react';

interface TypewriterTextProps {
  text: string;
  /** Characters per frame — higher = faster. Default 3. */
  speed?: number;
  /** Skip animation entirely (e.g. pre-existing messages on mount). */
  instant?: boolean;
  onDone?: () => void;
}

/**
 * Character-by-character reveal that looks like an AI is streaming a response.
 * Runs once on mount; does not re-animate if the text prop changes.
 */
export function TypewriterText({ text, speed = 3, instant = false, onDone }: TypewriterTextProps) {
  const [visible, setVisible] = useState(instant ? text.length : 0);

  useEffect(() => {
    if (instant) return;
    if (typeof window === 'undefined') return;

    // Respect prefers-reduced-motion
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setVisible(text.length);
      onDone?.();
      return;
    }

    let i = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      i = Math.min(text.length, i + speed);
      setVisible(i);
      if (i < text.length) {
        requestAnimationFrame(tick);
      } else {
        onDone?.();
      }
    };
    requestAnimationFrame(tick);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = text.slice(0, visible);
  const done = visible >= text.length;

  return (
    <span className="whitespace-pre-wrap">
      {shown}
      {!done && <span className="ml-0.5 inline-block h-[1.05em] w-[2px] -mb-[0.15em] bg-mint-400 animate-pulse align-middle" aria-hidden />}
    </span>
  );
}
