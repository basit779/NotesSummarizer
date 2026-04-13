import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, LogOut, Moon, Sun, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { useAuth } from '@/lib/auth';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-hero">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg">StudySnap<span className="gradient-text"> AI</span></span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/dashboard"><Button variant="ghost" size="sm">Dashboard</Button></Link>
              <Link to="/upload"><Button variant="ghost" size="sm">Upload</Button></Link>
              <Link to="/history"><Button variant="ghost" size="sm">History</Button></Link>
              <Link to="/billing">
                <Button variant={user.plan === 'PRO' ? 'default' : 'gradient'} size="sm" className="gap-1">
                  {user.plan === 'PRO' ? <><Sparkles className="h-3 w-3" /> Pro</> : 'Upgrade'}
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label="Toggle theme">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { logout(); navigate('/'); }}
                aria-label="Log out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label="Toggle theme">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
              <Link to="/signup"><Button variant="gradient" size="sm">Get started</Button></Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
