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
        'relative rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        glow && 'hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.16)] transition-shadow duration-300',
        tight ? 'p-4' : 'p-6',
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = 'GlassCard';
