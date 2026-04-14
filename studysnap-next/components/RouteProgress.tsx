'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(id);
  }, [pathname]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: '0% 50%' }}
          className="fixed top-0 left-0 right-0 z-[60] h-[2px] bg-gradient-to-r from-mint-500 to-mint-400"
        />
      )}
    </AnimatePresence>
  );
}
