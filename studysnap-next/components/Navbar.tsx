'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/client/auth';
import { cn } from '@/lib/utils';
import { MotionButton } from './ui/MotionButton';
import { UsageIndicator } from './UsageIndicator';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/upload',    label: 'Upload'    },
  { to: '/history',   label: 'History'   },
];

// ———————————————————————————————————————————————
// Document-mark logo — tiny glyph with mint middle rule
// (passes 5-meter test: the mint line reads from distance)
// ———————————————————————————————————————————————
function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2 pl-2">
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] shrink-0" aria-hidden>
        <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.2" className="text-white/30" fill="none" />
        <line x1="6" y1="7"  x2="14" y2="7"  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-white/35" />
        <line x1="6" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-mint-400" />
        <line x1="6" y1="15" x2="11" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-white/25" />
      </svg>
      <span className="text-[14.5px] font-semibold tracking-[-0.01em] text-white">
        StudySnap
      </span>
    </Link>
  );
}

// ———————————————————————————————————————————————
// NavLink — sliding-label hover reveal
// (adapted from 21st.dev Mini Navbar AnimatedNavLink)
// ———————————————————————————————————————————————
function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex h-8 items-center px-3 text-sm"
    >
      {/* Active indicator — mint underline, animated via layoutId across route changes */}
      {active && (
        <motion.span
          layoutId="nav-underline"
          className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-mint-400"
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          aria-hidden
        />
      )}
      {/* Sliding label — two stacked copies, hover rolls to the bright one */}
      <span className="relative block h-5 overflow-hidden">
        <span
          className={cn(
            'flex flex-col transition-transform duration-300 ease-out',
            !active && 'group-hover:-translate-y-1/2',
          )}
        >
          <span className={cn('leading-5', active ? 'text-white' : 'text-white/55')}>
            {children}
          </span>
          <span className="leading-5 text-white">{children}</span>
        </span>
      </span>
    </Link>
  );
}

// ———————————————————————————————————————————————
// Navbar
// ———————————————————————————————————————————————
export function Navbar() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const onLanding = pathname === '/';

  return (
    <div className="sticky top-0 z-40 pt-4">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-6xl px-4"
      >
        <div className="relative flex h-12 items-center justify-between rounded-xl border border-white/[0.06] bg-ink-900/70 pl-2 pr-2 backdrop-blur-xl">
          {/* Top hairline mint→transparent — echo of landing hero */}
          <div
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-mint-400/25 to-transparent"
            aria-hidden
          />

          <Logo />

          {loading && !user ? (
            <nav className="flex items-center gap-1" aria-hidden>
              <div className="h-8 w-24 rounded-md bg-white/[0.03]" />
            </nav>
          ) : user ? (
            <nav className="flex items-center gap-1">
              <div className="hidden md:flex items-center">
                {navItems.map((item) => (
                  <NavLink key={item.to} href={item.to} active={pathname === item.to}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
              <div className="hidden sm:block ml-2 mr-2">
                <UsageIndicator />
              </div>
              <Link href="/billing">
                <MotionButton
                  size="sm"
                  variant={user.plan === 'PRO' ? 'secondary' : 'primary'}
                  className="!rounded-[6px]"
                >
                  {user.plan === 'PRO' ? (
                    <><Sparkles className="h-3.5 w-3.5" /> Pro</>
                  ) : (
                    'Upgrade'
                  )}
                </MotionButton>
              </Link>
              <button
                onClick={() => { logout(); router.push('/'); }}
                aria-label="Log out"
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </nav>
          ) : (
            <nav className="flex items-center gap-1">
              {onLanding && (
                <div className="hidden md:flex items-center mr-2">
                  <NavLink href="#features" active={false}>Features</NavLink>
                  <NavLink href="#pricing"  active={false}>Pricing</NavLink>
                </div>
              )}
              <Link href="/login">
                <MotionButton size="sm" variant="ghost" className="!rounded-[6px]">
                  Log in
                </MotionButton>
              </Link>
              <Link href="/signup">
                <MotionButton size="sm" variant="primary" className="!rounded-[6px]">
                  Get started
                </MotionButton>
              </Link>
            </nav>
          )}
        </div>
      </motion.header>
    </div>
  );
}
