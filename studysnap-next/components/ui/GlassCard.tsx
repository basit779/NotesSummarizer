import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  tight?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, glow, tight, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl shadow-glass',
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl',
        'before:bg-gradient-to-b before:from-white/[0.04] before:to-transparent before:opacity-60',
        glow && 'hover:shadow-mint-glow transition-shadow duration-300',
        tight ? 'p-4' : 'p-6',
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = 'GlassCard';
