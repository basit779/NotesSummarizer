'use client';

import { motion, HTMLMotionProps, useMotionTemplate, useMotionValue } from 'framer-motion';
import { forwardRef, ReactNode, MouseEvent } from 'react';
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
  primary: 'bg-mint-500 text-ink-950 font-bold border border-mint-400/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
  secondary: 'bg-white/[0.05] text-white hover:bg-white/[0.1] border border-white/[0.1] backdrop-blur-md',
  ghost: 'text-white/80 hover:text-white hover:bg-white/[0.08] border border-transparent',
  outline: 'border border-white/[0.15] text-white hover:border-mint-500/50 hover:bg-mint-500/10 hover:text-mint-400 backdrop-blur-md',
  danger: 'bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20 hover:text-rose-400',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-xs rounded-xl tracking-wide',
  md: 'h-11 px-6 text-sm rounded-xl tracking-wide',
  lg: 'h-14 px-8 text-base rounded-2xl tracking-wide font-medium',
};

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    // Spotlight Effect logic
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
      const { left, top } = currentTarget.getBoundingClientRect();
      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    }

    const isPrimary = variant === 'primary';
    const isSecondaryOrOutline = variant === 'secondary' || variant === 'outline';

    const spotlightColor = isPrimary ? 'rgba(255, 255, 255, 0.4)' : isSecondaryOrOutline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)';

    return (
      <motion.button
        ref={ref}
        onMouseMove={handleMouseMove}
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.95 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        disabled={disabled || loading}
        className={cn(
          'group relative inline-flex items-center justify-center gap-2 whitespace-nowrap overflow-hidden transition-all duration-300',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
          'disabled:opacity-40 disabled:pointer-events-none cursor-pointer',
          variants[variant], sizes[size], className
        )}
        {...props}
      >
        {/* Spotlight overlay */}
        <motion.div
           className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
           style={{
              background: useMotionTemplate`
                radial-gradient(
                  80px circle at ${mouseX}px ${mouseY}px,
                  ${spotlightColor},
                  transparent 80%
                )
              `,
           }}
        />

        {/* Shine sweeping effect (mostly visible on primary but cool everywhere) */}
        {!disabled && !loading && (
           <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
        )}

        <span className="relative z-10 flex items-center justify-center gap-2">
           {loading ? <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
           {children}
        </span>
      </motion.button>
    );
  }
);
MotionButton.displayName = 'MotionButton';
