'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import {
  Brain, Target, Zap, FileText, Sparkles, Check, ArrowRight, Command,
  MessageSquare, Layers, Gauge, Lock,
} from 'lucide-react';
import { MotionButton } from '@/components/ui/MotionButton';
import { StudySnapLogo } from '@/components/brand/StudySnapLogo';
import { cn } from '@/lib/utils';

// ————————————————————————————————————————————————————————————————
// Local primitives sourced from 21st.dev `hero-with-mockup`
// ————————————————————————————————————————————————————————————————

function Glow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 w-full', className)}>
      <div className="absolute left-1/2 h-[256px] w-[60%] -translate-x-1/2 scale-[2.5] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_rgba(52,211,153,0.4)_10%,_transparent_60%)] sm:h-[512px]" />
      <div className="absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-[2] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.28)_10%,_transparent_60%)] sm:h-[256px]" />
    </div>
  );
}

function MockupFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 overflow-hidden rounded-2xl bg-white/[0.03] p-2 backdrop-blur-xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)]">
      <div className="relative z-10 flex overflow-hidden rounded-xl border border-white/[0.06] border-t-white/[0.12] shadow-2xl">
        {children}
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Data
// ————————————————————————————————————————————————————————————————

const features = [
  { icon: Brain,         title: 'Structured notes',   desc: 'Markdown-formatted study notes with headings, bullets, examples — not a wall of prose.' },
  { icon: Target,        title: 'Exam questions',     desc: 'MCQs with 4 options, correct answer, and explanation that grades why the distractors are wrong.' },
  { icon: Zap,           title: 'Flashcards',         desc: '22-40 cards per pack, spaced-repetition ready, CSV export for Anki.' },
  { icon: FileText,      title: 'Every definition',   desc: 'Ten+ precise definitions per pack. No glossary gaps, no jargon left unexplained.' },
  { icon: MessageSquare, title: 'Chat with your PDF', desc: 'Ask questions about the exact document you uploaded. Grounded answers, zero hallucinations.' },
  { icon: Layers,        title: 'Multi-model AI',     desc: 'Gemini 2.0 Flash primary, Groq Llama and OpenRouter fallback. Never locked to one vendor.' },
];

const HOW_STEPS = [
  { n: '01', title: 'Drop a PDF',   desc: 'Any lecture slide, textbook chapter, or research paper up to 15 MB.' },
  { n: '02', title: 'AI reads it',  desc: 'Gemini 2.0 Flash extracts every concept, term, and testable fact — ~20 seconds.' },
  { n: '03', title: 'Study faster', desc: 'Structured notes, flashcards, quiz, definitions. Plus an AI tutor grounded in your document.' },
];

// ————————————————————————————————————————————————————————————————
// Hero — Glow halo + MockupFrame
// ————————————————————————————————————————————————————————————————

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const mockY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const mockOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);

  return (
    <section ref={ref} className="relative overflow-hidden pb-16 pt-24 md:pt-32">
      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-12 px-6 text-center sm:gap-16">
        {/* Brand wordmark — living gradient sweep, mint halo intensifies on hover */}
        <motion.div
          initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6 }}
          className="relative inline-block"
        >
          <Link
            href="/"
            aria-label="StudySnap home"
            className="group relative inline-flex items-center gap-3 cursor-default px-4 py-2"
          >
            {/* Ambient glow halo — present at rest, intensifies and expands on hover */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-x-12 -inset-y-6 rounded-[50%] bg-mint-500/[0.06] blur-2xl transition-all duration-500 group-hover:bg-mint-500/[0.22] group-hover:blur-3xl group-hover:-inset-x-16"
            />
            {/* Stacked-books logo glyph */}
            <span className="relative text-mint-400 transition-transform duration-500 group-hover:scale-[1.04]">
              <StudySnapLogo size={44} />
            </span>
            {/* The wordmark — gradient shimmer sweeps across continuously */}
            <span
              className="relative inline-block bg-gradient-to-r from-white/70 via-mint-300 to-white/70 bg-clip-text pb-2 text-5xl font-semibold tracking-[-0.04em] text-transparent md:text-6xl"
              style={{
                backgroundSize: '250% 100%',
                animation: 'shimmer 4.5s ease-in-out infinite',
                lineHeight: 1.15,
              }}
            >
              StudySnap
            </span>
          </Link>
        </motion.div>

        {/* Display headline — Geist Sans, gradient on second line */}
        <motion.h1
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative z-10 inline-block max-w-3xl bg-gradient-to-br from-white to-white/60 bg-clip-text text-5xl font-semibold leading-[1.02] tracking-[-0.03em] text-transparent drop-shadow-[0_2px_24px_rgba(16,185,129,0.12)] sm:text-6xl md:text-7xl"
        >
          Study at the speed
          <br />
          <span className="bg-gradient-to-r from-mint-300 via-mint-400 to-emerald-400 bg-clip-text text-transparent">
            of thought.
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="relative z-10 max-w-xl text-base leading-relaxed text-white/60 md:text-lg"
        >
          Drop a PDF. Get exam-ready notes, flashcards, quizzes, definitions, and an AI tutor grounded in your document. Built for students who move fast.
        </motion.p>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="relative z-10 flex flex-col items-center gap-3"
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <MotionButton size="lg" className="!rounded-[6px]">
                Start free <ArrowRight className="h-4 w-4" />
              </MotionButton>
            </Link>
            <Link href="/login">
              <MotionButton size="lg" variant="outline" className="!rounded-[6px]">
                I have an account
              </MotionButton>
            </Link>
          </div>
          <div className="mono text-xs text-white/40">No credit card · 10 uploads/day free forever</div>
        </motion.div>

        {/* Mockup with Glow halo — signature element */}
        <motion.div
          style={{ y: mockY, opacity: mockOpacity }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full pt-12"
        >
          <Glow className="-top-32" />
          <MockupFrame>
            <div className="w-full">
              {/* window chrome */}
              <div className="flex items-center gap-1.5 border-b border-white/[0.05] bg-ink-950 px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="ml-3 flex items-center gap-2 rounded-md bg-white/[0.04] px-3 py-1 mono text-[11px] text-white/55">
                  <Command className="h-3 w-3" /> biology-ch12.pdf
                </div>
                <div className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-mint-500/25 bg-mint-500/[0.08] px-2 py-0.5 mono text-[10px] text-mint-300">
                  <span className="h-1 w-1 rounded-full bg-mint-400" /> gemini 2.0 flash
                </div>
              </div>
              {/* body */}
              <div className="grid bg-ink-950 md:grid-cols-[200px_1fr_260px]">
                {/* sidebar */}
                <div className="space-y-1 border-r border-white/[0.05] p-4">
                  <div className="mono px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-white/40">Contents</div>
                  {[
                    { l: 'Notes',       a: true  },
                    { l: 'Key points',  a: false },
                    { l: 'Definitions', a: false },
                    { l: 'Flashcards',  a: false },
                    { l: 'Quiz',        a: false },
                    { l: 'Ask AI',      a: false },
                  ].map((t) => (
                    <div
                      key={t.l}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2.5 py-2 text-[12.5px]',
                        t.a ? 'bg-white/[0.05] text-white' : 'text-white/50',
                      )}
                    >
                      {t.a && <span className="h-3 w-[2px] rounded-full bg-mint-400" />}
                      <span className={t.a ? '' : 'ml-[10px]'}>{t.l}</span>
                    </div>
                  ))}
                </div>
                {/* notes pane */}
                <div className="space-y-3 p-6 text-left">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-4 w-[3px] rounded-full bg-mint-400" />
                    <div className="text-[14px] font-semibold text-white tracking-tight">Cellular respiration</div>
                  </div>
                  <div className="h-3 w-full rounded bg-white/[0.06]" />
                  <div className="h-3 w-[94%] rounded bg-white/[0.06]" />
                  <div className="h-3 w-[78%] rounded bg-white/[0.06]" />
                  <div className="flex items-center gap-2 pt-3">
                    <span className="inline-block h-4 w-[3px] rounded-full bg-mint-400" />
                    <div className="text-[14px] font-semibold text-white tracking-tight">Key stages</div>
                  </div>
                  <div className="space-y-2 pl-5">
                    {[80, 64, 72].map((w, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-mint-400/70" />
                        <div className="h-3 rounded bg-white/[0.055]" style={{ width: `${w}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-3">
                    <div className="rounded-lg border border-mint-500/25 bg-mint-500/[0.05] p-3">
                      <div className="mono text-[10px] uppercase tracking-[0.12em] text-mint-400">Flashcard · 1/24</div>
                      <div className="mt-1 text-xs text-white/85">What is mitochondrial DNA?</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="mono text-[10px] uppercase tracking-[0.12em] text-white/40">Flashcard · 2/24</div>
                      <div className="mt-1 text-xs text-white/40">Tap to reveal</div>
                    </div>
                  </div>
                </div>
                {/* chat rail */}
                <div className="hidden border-l border-white/[0.05] p-4 text-left md:block">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border border-mint-500/25 bg-mint-500/10">
                      <Sparkles className="h-3 w-3 text-mint-400" />
                    </div>
                    <div className="mono text-[11px] text-white/60">Ask about pack</div>
                  </div>
                  <div className="mb-2 ml-6 rounded-xl border border-mint-500/20 bg-mint-500/[0.08] p-2.5 text-[11.5px] text-white/90">
                    Which stage produces most ATP?
                  </div>
                  <div className="mr-6 rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5 text-[11.5px] text-white/75">
                    <span className="text-mint-300">▸</span> The electron transport chain produces ~34 ATP, by far the largest yield…
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] text-white/40">
                    Ask something…
                    <div className="h-5 w-5 rounded-md bg-mint-500/80" />
                  </div>
                </div>
              </div>
            </div>
          </MockupFrame>
        </motion.div>
      </div>
    </section>
  );
}

// ————————————————————————————————————————————————————————————————
// ProofStrip
// ————————————————————————————————————————————————————————————————

function ProofStrip() {
  const facts = [
    { icon: Gauge,  label: '~20s',   hint: 'Pack generation' },
    { icon: Layers, label: '30+',    hint: 'Flashcards per pack' },
    { icon: Lock,   label: '0',      hint: 'Cards required' },
    { icon: Zap,    label: 'Gemini', hint: '2.0 Flash inside' },
  ];

  return (
    <section className="py-8">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {facts.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 p-5"
            >
              <f.icon className="h-4 w-4 shrink-0 text-mint-400" />
              <div>
                <div className="mono text-[18px] font-semibold leading-tight tracking-tight text-white">{f.label}</div>
                <div className="mt-0.5 text-[11.5px] text-white/45">{f.hint}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ————————————————————————————————————————————————————————————————
// HowItWorks — big numerals, hairline cards
// ————————————————————————————————————————————————————————————————

function HowItWorks() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <div className="mono text-[11px] uppercase tracking-[0.18em] text-mint-400">How it works</div>
          <h2 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.025em] text-white md:text-5xl">
            Three steps. <span className="text-white/40">Zero busywork.</span>
          </h2>
        </motion.div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {HOW_STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="group relative rounded-xl border border-white/[0.06] bg-white/[0.015] p-7 transition-colors duration-200 hover:border-white/[0.12] hover:bg-white/[0.03]"
            >
              <div className="mono text-[44px] font-semibold leading-none text-white/15 transition-colors duration-300 group-hover:text-mint-400/40">{s.n}</div>
              <h3 className="mt-5 text-[17px] font-semibold tracking-tight text-white">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/55">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ————————————————————————————————————————————————————————————————
// Features
// ————————————————————————————————————————————————————————————————

function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <div className="mono text-[11px] uppercase tracking-[0.18em] text-mint-400">Capabilities</div>
          <h2 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.025em] text-white md:text-5xl">
            One upload. <span className="text-white/40">Six outputs.</span>
          </h2>
          <p className="mt-4 max-w-lg text-white/60">
            Zero busywork. Every feature designed for students who actually want to learn, not skim.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors duration-200 hover:border-white/[0.12] hover:bg-white/[0.035]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] transition-colors duration-200 group-hover:border-mint-500/40 group-hover:bg-mint-500/[0.08]">
                <f.icon className="h-5 w-5 text-white/70 transition-colors duration-200 group-hover:text-mint-400" />
              </div>
              <h3 className="mt-5 text-[15.5px] font-semibold tracking-tight text-white">{f.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ————————————————————————————————————————————————————————————————
// Pricing — compound-style cards, glass-top hairline
// ————————————————————————————————————————————————————————————————

function Pricing() {
  const free = [
    '10 PDF uploads / day',
    'Markdown-structured notes',
    'Flashcards & definitions',
    'Quiz mode with explanations',
    'Ask-AI chat per pack',
    'Community support',
  ];
  const pro = [
    'Unlimited uploads',
    'Priority processing',
    'Advanced exam questions',
    'Flashcard CSV export',
    'Priority AI models',
    'Email support',
  ];

  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <div className="mono text-[11px] uppercase tracking-[0.18em] text-mint-400">Pricing</div>
          <h2 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.025em] text-white md:text-5xl">
            Start free. <span className="text-white/40">Upgrade when it clicks.</span>
          </h2>
        </motion.div>

        <div className="mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
          {/* Free */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
            <div className="p-8">
              <div className="mono text-[11px] uppercase tracking-[0.15em] text-white/50">Free</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-semibold tracking-[-0.025em] text-white">$0</span>
                <span className="text-sm text-white/40">/month</span>
              </div>
              <ul className="mt-8 space-y-3">
                {free.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/50" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-8 block">
                <MotionButton variant="outline" className="w-full !rounded-[6px]">Get started</MotionButton>
              </Link>
            </div>
          </motion.div>

          {/* Pro — glass-top mint gradient */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="relative overflow-hidden rounded-xl border border-mint-500/25 bg-gradient-to-b from-mint-500/[0.05] via-mint-500/[0.015] to-transparent"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mint-400/60 to-transparent" />
            <div className="absolute right-4 top-4 rounded-full border border-mint-500/30 bg-mint-500/[0.12] px-2 py-0.5 mono text-[10px] uppercase tracking-[0.12em] text-mint-300">
              Recommended
            </div>
            <div className="p-8">
              <div className="mono text-[11px] uppercase tracking-[0.15em] text-mint-400">Pro</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-semibold tracking-[-0.025em] text-white">$9</span>
                <span className="text-sm text-white/40">/month</span>
              </div>
              <ul className="mt-8 space-y-3">
                {pro.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint-400" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-8 block">
                <MotionButton className="w-full !rounded-[6px]">Go Pro</MotionButton>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ————————————————————————————————————————————————————————————————
// FinalCTA — single Glow halo, echo of hero signature
// ————————————————————————————————————————————————————————————————

function FinalCTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015] p-10 text-center md:p-14"
        >
          <Glow className="-top-24" />
          <div className="relative">
            <div className="mono text-[11px] uppercase tracking-[0.18em] text-mint-400">Stop highlighting. Start learning.</div>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.025em] text-white md:text-5xl">
              Your next exam<br />
              <span className="bg-gradient-to-r from-mint-300 to-emerald-400 bg-clip-text text-transparent">
                starts with one upload.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-white/65 md:text-base">
              No credit card. 10 free PDFs every day. Generate your first study pack in under a minute.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/signup">
                <MotionButton size="lg" className="!rounded-[6px]">
                  Get started free <ArrowRight className="h-4 w-4" />
                </MotionButton>
              </Link>
              <Link href="/login">
                <MotionButton size="lg" variant="outline" className="!rounded-[6px]">
                  Log in
                </MotionButton>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProofStrip />
      <HowItWorks />
      <Features />
      <Pricing />
      <FinalCTA />
    </>
  );
}
