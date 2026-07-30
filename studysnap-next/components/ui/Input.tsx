import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-xl border border-black/[0.12] bg-white px-4 py-2 text-sm text-black placeholder:text-black/35',
        'transition-colors hover:border-black/20',
        'focus-visible:outline-none focus-visible:border-black/60 focus-visible:ring-2 focus-visible:ring-black/10',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
