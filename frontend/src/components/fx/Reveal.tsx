import { motion, Variants } from 'framer-motion';
import { PropsWithChildren } from 'react';

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export function Reveal({ children, className, as = 'div' }: PropsWithChildren<{ className?: string; as?: 'div' | 'section' | 'ul' }>) {
  const Tag: any = motion[as];
  return (
    <Tag initial="hidden" animate="show" variants={container} className={className}>
      {children}
    </Tag>
  );
}

export function RevealItem({ children, className, delay = 0 }: PropsWithChildren<{ className?: string; delay?: number }>) {
  return (
    <motion.div variants={item} className={className} transition={{ delay }}>
      {children}
    </motion.div>
  );
}
