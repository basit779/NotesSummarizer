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
        'relative rounded-2xl border border-black/[0.06] bg-white',
        'shadow-[0_1px_2px_rgba(0,0,0,0.03),0_1px_1px_rgba(0,0,0,0.02)]',
        glow && 'transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-black/[0.12] hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_20px_40px_-20px_rgba(0,0,0,0.18)]',
        tight ? 'p-4' : 'p-6',
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = 'GlassCard';
