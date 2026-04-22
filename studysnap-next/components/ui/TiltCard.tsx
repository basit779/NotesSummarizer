'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  glowClassName?: string;
  glowOpacity?: number;
}

export function TiltCard({ children, className, glowClassName, glowOpacity = 0.15 }: TiltCardProps) {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const springConfig = { damping: 20, stiffness: 200, mass: 0.5 };
  const mouseXSpring = useSpring(x, springConfig);
  const mouseYSpring = useSpring(y, springConfig);

  const rotateX = useTransform(mouseYSpring, [0, 1], [3, -3]);
  const rotateY = useTransform(mouseXSpring, [0, 1], [-3, 3]);

  // Glow position logic
  const backgroundX = useTransform(mouseXSpring, [0, 1], ['0%', '100%']);
  const backgroundY = useTransform(mouseYSpring, [0, 1], ['0%', '100%']);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width);
    y.set(mouseY / height);
  };

  const handleMouseLeave = () => {
    x.set(0.5);
    y.set(0.5);
  };

  return (
    <motion.div
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn('relative group perspective-1000', className)}
    >
      <motion.div
        className={cn(
          'absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100',
          glowClassName
        )}
        style={{
          background: useTransform(
            () =>
              `radial-gradient(500px circle at ${backgroundX.get()} ${backgroundY.get()}, rgba(16, 185, 129, ${glowOpacity}), transparent 40%)`
          ),
        }}
      />
      <div className="relative h-full w-full rounded-xl bg-ink-950/80 backdrop-blur-xl border border-white/[0.06] overflow-hidden z-10 p-6 flex flex-col">
        {children}
      </div>
    </motion.div>
  );
}
