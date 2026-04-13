import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { MotionButton } from './ui/MotionButton';
import { UsageIndicator } from './UsageIndicator';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/upload', label: 'Upload' },
  { to: '/history', label: 'History' },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onLanding = location.pathname === '/';

  return (
    <div className="sticky top-0 z-40 pt-4">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-6xl px-4"
      >
        <div className="glass-strong flex h-14 items-center justify-between rounded-2xl px-3 pr-2">
          <Link to="/" className="flex items-center gap-2.5 pl-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-mint-500/15 border border-mint-500/30">
              <div className="h-2 w-2 rounded-full bg-mint-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.8)]" />
            </div>
            <span className="mono text-[15px] font-semibold tracking-tight text-white">
              studysnap<span className="text-mint-400">.</span>
            </span>
          </Link>

          {user ? (
            <nav className="flex items-center gap-1">
              <div className="hidden md:flex items-center gap-0.5">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'relative px-3 py-1.5 text-sm text-white/60 hover:text-white transition-colors rounded-lg cursor-pointer',
                        isActive && 'text-white',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {item.label}
                        {isActive && (
                          <motion.span
                            layoutId="nav-underline"
                            className="absolute inset-0 -z-10 rounded-lg bg-white/[0.06]"
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
              <div className="hidden sm:block"><UsageIndicator /></div>
              <Link to="/billing">
                <MotionButton
                  size="sm"
                  variant={user.plan === 'PRO' ? 'secondary' : 'primary'}
                  className="ml-1"
                >
                  {user.plan === 'PRO' ? (
                    <><Sparkles className="h-3.5 w-3.5" /> Pro</>
                  ) : (
                    'Upgrade'
                  )}
                </MotionButton>
              </Link>
              <button
                onClick={() => { logout(); navigate('/'); }}
                aria-label="Log out"
                className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </nav>
          ) : (
            <nav className="flex items-center gap-1">
              {onLanding && (
                <div className="hidden md:flex items-center gap-0.5 pr-2">
                  <a href="#features" className="px-3 py-1.5 text-sm text-white/60 hover:text-white transition-colors cursor-pointer">Features</a>
                  <a href="#pricing" className="px-3 py-1.5 text-sm text-white/60 hover:text-white transition-colors cursor-pointer">Pricing</a>
                </div>
              )}
              <Link to="/login">
                <MotionButton size="sm" variant="ghost">Log in</MotionButton>
              </Link>
              <Link to="/signup">
                <MotionButton size="sm" variant="primary">Get started</MotionButton>
              </Link>
            </nav>
          )}
        </div>
      </motion.header>
    </div>
  );
}
