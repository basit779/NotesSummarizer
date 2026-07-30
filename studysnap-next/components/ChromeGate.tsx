'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { GridBackground } from './fx/GridBackground';

const NO_CHROME_ROUTES = new Set(['/']);

export function ChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (NO_CHROME_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <GridBackground />
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
