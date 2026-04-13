'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface MotionButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-mint-500 text-ink-950 hover:bg-mint-400 shadow-[0_0_0_1px_rgba(16,185,129,0.3),0_10px_40px_-10px_rgba(16,185,129,0.6)] font-medium',
  secondary: 'bg-white/[0.06] text-white hover:bg-white/[0.10] border border-white/[0.08]',
  ghost: 'text-white/80 hover:text-white hover:bg-white/[0.05]',
  outline: 'border border-white/[0.15] text-white hover:border-mint-500/60 hover:text-mint-400',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-5 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-xl',
};

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
        'disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        variants[variant], sizes[size], className,
      )}
      {...props}
    >
      {loading ? <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
      {children}
    </motion.button>
  ),
);
MotionButton.displayName = 'MotionButton';
