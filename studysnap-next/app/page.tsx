'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Plus, LayoutDashboard, LogOut, Gauge, Layers, Lock, Zap,
  Brain, Target, FileText, MessageSquare, Check, ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/client/auth';
import { StudySnapLogo } from '@/components/brand/StudySnapLogo';
import { MotionButton } from '@/components/ui/MotionButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { Footer } from '@/components/Footer';
import { cn, GLOSS_BLACK } from '@/lib/utils';
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
              <a href="#features" className={styles.menuDropdownLink} onClick={() => setOpen(false)}>
                Features
              </a>
              <a href="#pricing" className={styles.menuDropdownLink} onClick={() => setOpen(false)}>
                Pricing
              </a>
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

// ————————————————————————————————————————————————————————————————
// Below-the-fold marketing sections
// ————————————————————————————————————————————————————————————————

const FACTS = [
  { icon: Gauge,  label: '~30s', hint: 'Typical processing' },
  { icon: Layers, label: '38+',  hint: 'Cards per pack' },
  { icon: Lock,   label: '0',    hint: 'Setup required' },
  { icon: Zap,    label: '4×',   hint: 'AI fallback chain' },
];

const HOW_STEPS = [
  { n: '01', title: 'Drop a file',    desc: 'Any lecture slide, textbook chapter, or research paper — PDF, DOCX, PPTX, XLSX up to 15 MB.' },
  { n: '02', title: 'AI extracts it', desc: 'A multi-model chain reads every concept, term, and testable fact — with automatic fallback so it always completes.' },
  { n: '03', title: 'Study faster',   desc: 'Structured notes, flashcards, quiz, definitions — plus an AI tutor grounded in your document.' },
];

const FEATURES = [
  { icon: Brain,         title: 'Structured notes',   desc: 'Markdown-formatted study notes with headings, bullets, examples — not a wall of prose.' },
  { icon: Target,        title: 'Exam questions',      desc: 'MCQs with four options, the correct answer, and an explanation of why the others are wrong.' },
  { icon: Zap,           title: 'Flashcards',          desc: 'Up to ~38 cards per pack, spaced-repetition ready, CSV export for Anki on Pro.' },
  { icon: FileText,      title: 'Every definition',    desc: 'Ten-plus precise definitions per pack. No glossary gaps, no jargon left unexplained.' },
  { icon: MessageSquare, title: 'Chat with your PDF',  desc: 'Ask questions about the exact document you uploaded — grounded answers, zero hallucinations.' },
  { icon: Layers,        title: 'Multi-model AI',      desc: 'Gemini primary with DeepSeek, Llama, and Mistral fallbacks. Your pack always ships.' },
];

const FREE_PLAN = ['10 uploads / day', 'Structured notes & key points', 'Flashcards & definitions', 'Quiz with explained answers'];
const PRO_PLAN = ['Unlimited uploads', 'Priority AI processing', 'Advanced exam questions', 'Flashcard CSV export', 'Priority model access'];

function ProofStrip() {
  return (
    <section className="border-y border-black/[0.08] bg-white">
      <div className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-y-8 md:divide-x md:divide-black/[0.08]">
        {FACTS.map((f, i) => (
          <motion.div
            key={f.hint}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }}
            className="flex items-center justify-center gap-3 px-2"
          >
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white', GLOSS_BLACK)}>
              <f.icon className="h-4 w-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-2xl font-semibold tracking-tight text-black leading-none">{f.label}</span>
              <span className="mt-1 text-[12px] text-black/45">{f.hint}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="py-24 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-14"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.02em] text-black">
            Three steps. <span className="text-black/35">Zero busywork.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {HOW_STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: EASE }}
            >
              <GlassCard className="h-full">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.1] bg-black/[0.03] text-[13px] font-medium text-black/60">
                  {s.n}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-black tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[14px] text-black/55 leading-relaxed">{s.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-24 md:py-28 border-t border-black/[0.08] bg-black/[0.015] scroll-mt-20">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-14 max-w-lg"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.02em] text-black">
            One PDF. <span className="text-black/35">Complete arsenal.</span>
          </h2>
          <p className="mt-4 text-[15px] text-black/55 leading-relaxed">
            Everything you need to master your material, extracted instantly. Stop highlighting. Start learning.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.06, duration: 0.45, ease: EASE }}
              className="rounded-2xl border border-black/[0.08] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.04]">
                <f.icon className="h-[18px] w-[18px] text-black/70" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-black">{f.title}</h3>
              <p className="mt-1.5 text-[13px] text-black/50 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-28 border-t border-black/[0.08] scroll-mt-20">
      <div className="mx-auto max-w-3xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: EASE }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.02em] text-black">
            Start free. <span className="text-black/35">Scale up.</span>
          </h2>
          <p className="mt-3 text-[15px] text-black/55">Generous limits forever. More power when you need it.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: EASE }}
            className="rounded-2xl border border-black/[0.08] bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col"
          >
            <div className="text-[12px] font-medium text-black/45 uppercase tracking-wide">Free</div>
            <div className="mt-2 text-4xl font-semibold tracking-tight text-black">$0</div>
            <ul className="mt-6 space-y-3 flex-1">
              {FREE_PLAN.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[13.5px] text-black/70">
                  <Check className="h-4 w-4 text-black/35 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="mt-7">
              <MotionButton variant="outline" className="w-full">Get started</MotionButton>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
            className={cn('relative rounded-2xl border border-black p-7 flex flex-col', GLOSS_BLACK)}
          >
            <div className="absolute right-5 top-5 rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white">
              Recommended
            </div>
            <div className="text-[12px] font-medium text-white/60 uppercase tracking-wide">Pro</div>
            <div className="mt-2 text-4xl font-semibold tracking-tight text-white">$9</div>
            <ul className="mt-6 space-y-3 flex-1">
              {PRO_PLAN.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[13.5px] text-white/80">
                  <Check className="h-4 w-4 text-white/50 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="mt-7">
              <MotionButton className="w-full !bg-none !bg-white !text-black hover:!opacity-90">Go Pro</MotionButton>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-24 md:py-32 border-t border-black/[0.08]">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.02em] text-black">
            A smarter way to study is one click away.
          </h2>
          <p className="mt-4 text-[15px] text-black/55">
            Stop re-reading and start testing yourself. 10 free uploads a day, every day.
          </p>
          <Link href="/signup" className="mt-8 inline-block">
            <MotionButton size="lg">
              Upload your first PDF <ArrowRight className="h-4 w-4" />
            </MotionButton>
          </Link>
        </motion.div>
      </div>
    </section>
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

      <section className={styles.heroSection}>
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
      </section>

      <ProofStrip />
      <HowItWorks />
      <Features />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
