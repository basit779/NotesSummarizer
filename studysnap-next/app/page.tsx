'use client';

import { useEffect } from 'react';
import { Inter } from 'next/font/google';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import styles from './page.module.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

const EASE = [0.16, 1, 0.3, 1] as const;

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_215831_c6a8989c-d716-4d8d-8745-e972a2eec711.mp4';

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="6.5" width="20" height="5" rx="2.5" fill="#000" transform="rotate(-35 12 12)" />
      <rect x="2" y="14.5" width="20" height="5" rx="2.5" fill="#000" transform="rotate(-35 12 12)" />
    </svg>
  );
}

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

export default function LandingPage() {
  useEffect(() => {
    document.body.setAttribute('data-landing', 'true');
    return () => {
      document.body.removeAttribute('data-landing');
    };
  }, []);

  return (
    <div className={`${styles.page} ${inter.className}`}>
      <motion.nav
        className={styles.navbar}
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
        aria-label="Primary"
      >
        <div className={styles.navbarInner}>
          <div className={styles.navLeft}>
            <div className={styles.logoGroup}>
              <span className={styles.logoIcon}>
                <LogoMark />
              </span>
              <span className={styles.brandText}>NeuralKinetics</span>
            </div>

            <button type="button" className={styles.menuButton} aria-label="Open menu">
              <span className={styles.menuCircle}>
                <Plus size={12} strokeWidth={3} />
              </span>
              <span className={styles.menuLabel}>Menu</span>
            </button>

            <div className={styles.tagsPill}>
              <span className={styles.tagText}>Advanced Bionics</span>
              <span className={styles.tagDivider} />
              <span className={styles.tagText}>Cognitive AI</span>
            </div>
          </div>

          <div className={styles.navRight}>
            <button type="button" className={styles.rightPill} aria-label="Adaptive systems">
              <span className={styles.rightCircle}>
                <GridIcon />
              </span>
              <span className={styles.rightLabel}>Adaptive Systems</span>
            </button>
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
            <span className={styles.subtitleText}>Best digital banking card 2026</span>
          </motion.div>

          <motion.h1
            className={styles.heading}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8, ease: EASE }}
          >
            One Card, Zero
            <br />
            Limits. Worldwide.
          </motion.h1>

          <motion.div
            className={styles.buttonsRow}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.8, ease: EASE }}
          >
            <button type="button" className={styles.btnPrimary}>
              See Features
            </button>
            <button type="button" className={styles.btnSecondary}>
              How It Works
            </button>
          </motion.div>
        </div>

        <div className={styles.footerRight}>
          <span className={styles.rightTagPill}>Neuromorphic</span>
          <span className={styles.rightTagPill}>AGI</span>
          <span className={styles.rightTagPill}>Cybernetics</span>
        </div>
      </motion.div>
    </div>
  );
}
