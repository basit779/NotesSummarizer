'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface MotionButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-black text-white hover:opacity-85',
  secondary: 'bg-black/[0.05] text-black hover:bg-black/[0.08] border border-black/[0.08]',
  ghost: 'text-black/70 hover:text-black hover:bg-black/[0.05] border border-transparent',
  outline: 'border border-black/30 text-black hover:bg-black/[0.04] hover:border-black/50',
  danger: 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-xs rounded-full tracking-wide',
  md: 'h-11 px-6 text-sm rounded-full tracking-wide',
  lg: 'h-14 px-8 text-base rounded-full tracking-wide font-medium',
};

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white',
          'disabled:opacity-40 disabled:pointer-events-none cursor-pointer',
          variants[variant], sizes[size], className
        )}
        {...props}
      >
        {loading ? <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
        {children}
      </motion.button>
    );
  }
);
MotionButton.displayName = 'MotionButton';
