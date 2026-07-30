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
  primary:
    'bg-gradient-to-b from-neutral-800 to-black text-white ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_1px_rgba(0,0,0,0.2),0_8px_20px_-8px_rgba(0,0,0,0.4)] ' +
    'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_1px_rgba(0,0,0,0.25),0_14px_28px_-8px_rgba(0,0,0,0.5)] ' +
    'active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]',
  secondary:
    'bg-black/[0.04] text-black border border-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.02)] ' +
    'hover:bg-black/[0.07] hover:border-black/[0.14]',
  ghost: 'text-black/65 hover:text-black hover:bg-black/[0.05] border border-transparent',
  outline:
    'border border-black/[0.18] text-black hover:bg-black/[0.03] hover:border-black/30 ' +
    'shadow-[0_1px_2px_rgba(0,0,0,0.02)]',
  danger:
    'bg-rose-50 text-rose-600 border border-rose-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ' +
    'hover:bg-rose-100 hover:border-rose-300',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-xs rounded-full tracking-wide',
  md: 'h-11 px-6 text-sm rounded-full tracking-wide',
  lg: 'h-14 px-8 text-base rounded-full tracking-wide font-medium',
};

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const inert = disabled || loading;
    return (
      <motion.button
        ref={ref}
        whileHover={inert ? undefined : { scale: 1.015, y: -1 }}
        whileTap={inert ? undefined : { scale: 0.975, y: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        disabled={inert}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background,box-shadow,border-color,color] duration-200',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-black/[0.12] focus-visible:ring-offset-2 focus-visible:ring-offset-white',
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
