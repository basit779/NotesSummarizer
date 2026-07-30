'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/client/auth';
import { StudySnapLogo } from '@/components/brand/StudySnapLogo';
import styles from './page.module.css';

const EASE = [0.16, 1, 0.3, 1] as const;

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_215831_c6a8989c-d716-4d8d-8745-e972a2eec711.mp4';

function GridIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <circle cx="2.25" cy="2.25" r="1.5" fill="#fff" />
      <circle cx="7.75" cy="2.25" r="1.5" fill="#fff" />
      <circle cx="2.25" cy="7.75" r="1.5" fill="#fff" />
      <circle cx="7.75" cy="7.75" r="1.5" fill="#fff" />
    </svg>
  );
}

function MenuDropdown() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className={styles.menuWrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.menuButton}
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.menuCircle}>
          <Plus size={12} strokeWidth={3} style={{ transform: open ? 'rotate(45deg)' : undefined, transition: 'transform 0.2s ease' }} />
        </span>
        <span className={styles.menuLabel}>Menu</span>
      </button>

      {open && (
        <div className={styles.menuDropdown}>
          {!loading && user ? (
            <>
              <Link href="/dashboard" className={styles.menuDropdownLink} onClick={() => setOpen(false)}>
                <LayoutDashboard size={14} /> Dashboard
              </Link>
              <button
                type="button"
                className={styles.menuDropdownLink}
                onClick={() => { logout(); setOpen(false); router.push('/'); }}
              >
                <LogOut size={14} /> Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={styles.menuDropdownLink} onClick={() => setOpen(false)}>
                Log in
              </Link>
              <Link href="/signup" className={styles.menuDropdownLink} onClick={() => setOpen(false)}>
                Get started
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <motion.nav
        className={styles.navbar}
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
        aria-label="Primary"
      >
        <div className={styles.navbarInner}>
          <div className={styles.navLeft}>
            <Link href="/" className={styles.logoGroup} aria-label="StudySnap home">
              <span className={styles.logoIcon}>
                <StudySnapLogo size={22} color="#000" cutoutColor="#fff" />
              </span>
              <span className={styles.brandText}>StudySnap</span>
            </Link>

            <MenuDropdown />

            <div className={styles.tagsPill}>
              <span className={styles.tagText}>Study Packs</span>
              <span className={styles.tagDivider} />
              <span className={styles.tagText}>AI Tutor</span>
            </div>
          </div>

          <div className={styles.navRight}>
            <div className={styles.rightPill}>
              <span className={styles.rightCircle}>
                <GridIcon />
              </span>
              <span className={styles.rightLabel}>Multi-Model AI</span>
            </div>
          </div>
        </div>
      </motion.nav>

      <motion.div
        className={styles.videoLayer}
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.8, ease: EASE }}
        aria-hidden="true"
      >
        <div className={styles.videoWrapper}>
          <video
            className={styles.video}
            src={VIDEO_URL}
            autoPlay
            muted
            loop
            playsInline
          />
        </div>
      </motion.div>

      <motion.div
        className={styles.footerWrapper}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 1, ease: EASE }}
      >
        <div className={styles.footerLeft}>
          <motion.div
            className={styles.subtitleLine}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8, ease: EASE }}
          >
            <span className={styles.dot} />
            <span className={styles.subtitleText}>10 free AI study packs, every day</span>
          </motion.div>

          <motion.h1
            className={styles.heading}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8, ease: EASE }}
          >
            Study at the speed
            <br />
            of thought.
          </motion.h1>

          <motion.div
            className={styles.buttonsRow}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.8, ease: EASE }}
          >
            <Link href="/signup" className={styles.btnPrimary}>
              Start Free
            </Link>
            <Link href="/login" className={styles.btnSecondary}>
              I have an account
            </Link>
          </motion.div>
        </div>

        <div className={styles.footerRight}>
          <span className={styles.rightTagPill}>Flashcards</span>
          <span className={styles.rightTagPill}>Quizzes</span>
          <span className={styles.rightTagPill}>AI Chat</span>
        </div>
      </motion.div>
    </div>
  );
}
