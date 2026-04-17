'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import {
  Brain, Target, Zap, FileText, BookOpen, Sparkles, Check, ArrowRight, Command,
  MessageSquare, Layers, Gauge, Lock, Github,
} from 'lucide-react';
import { MotionButton } from '@/components/ui/MotionButton';
import { GlassCard } from '@/components/ui/GlassCard';

const features = [
  { icon: Brain,         title: 'Structured notes',   desc: 'Markdown-formatted study notes with headings, bullets, examples — not a wall of prose.' },
  { icon: Target,        title: 'Exam questions',     desc: 'MCQs with 4 options, correct answer, and explanation that grades why the distractors are wrong.' },
  { icon: Zap,           title: 'Flashcards',         desc: '22-40 cards per pack, spaced-repetition ready, CSV export for Anki.' },
  { icon: FileText,      title: 'Every definition',   desc: 'Ten+ precise definitions per pack. No glossary gaps, no jargon left unexplained.' },
  { icon: MessageSquare, title: 'Chat with your PDF', desc: 'Ask questions about the exact document you uploaded. Grounded answers, zero hallucinations.' },
  { icon: Layers,        title: 'Multi-model AI',     desc: 'Gemini 2.0 Flash primary, Groq Llama and OpenRouter fallback. Never locked to one vendor.' },
];

const HOW_STEPS = [
  { n: '01', title: 'Drop a PDF',    desc: 'Any lecture slide, textbook chapter, or research paper up to 15 MB.' },
  { n: '02', title: 'AI reads it',   desc: 'Gemini 2.0 Flash extracts every concept, term, and testable fact — ~20 seconds.' },
  { n: '03', title: 'Study faster',  desc: 'Structured notes, flashcards, quiz, definitions. Plus an AI tutor grounded in your document.' },
];

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const mockY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const mockOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);
  const headline = ['Study', 'at', 'the', 'speed', 'of', 'thought.'];

  return (
    <section ref={ref} className="relative pt-28 pb-16 md:pt-40 md:pb-24 overflow-hidden">
      {/* Ambient gradient mesh */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[800px] w-[1100px] rounded-full bg-mint-500/[0.10] blur-[160px]" />
        <div className="absolute top-32 -left-20 h-80 w-80 rounded-full bg-mint-500/[0.06] blur-3xl" />
        <div className="absolute top-52 right-0 h-72 w-72 rounded-full bg-mint-500/[0.05] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="inline-flex items-center gap-2 rounded-full border border-mint-500/20 bg-mint-500/[0.06] px-3 py-1 text-xs text-mint-300"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-mint-500/70" />
            <span className="relative rounded-full bg-mint-400 h-1.5 w-1.5" />
          </span>
          <span className="mono">v1.0 · now in public beta · free forever</span>
        </motion.div>

        <h1 className="mt-8 mono text-[44px] leading-[1.02] tracking-tightest font-semibold text-white md:text-[88px] text-balance">
          {headline.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block mr-[0.22em]"
            >
              {word === 'thought.' ? <span className="bg-gradient-to-r from-mint-300 via-mint-400 to-emerald-500 bg-clip-text text-transparent">{word}</span> : word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-6 max-w-xl text-[17px] md:text-lg text-white/60 text-balance leading-relaxed"
        >
          Drop a PDF. Get exam-ready notes, flashcards, quizzes, definitions, and an AI tutor grounded in your document. Built for students who move fast.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          <Link href="/signup"><MotionButton size="lg">Start free <ArrowRight className="h-4 w-4" /></MotionButton></Link>
          <Link href="/login"><MotionButton size="lg" variant="outline">I have an account</MotionButton></Link>
          <span className="mono text-xs text-white/40 ml-1">no card · 10 uploads/day free</span>
        </motion.div>

        <motion.div
          style={{ y: mockY, opacity: mockOpacity }}
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-20 md:mt-24 mx-auto max-w-5xl"
        >
          <div className="relative">
            <div className="absolute -inset-10 bg-mint-500/[0.10] blur-3xl rounded-full" />
            <div className="relative rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.05]">
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="ml-3 flex items-center gap-2 rounded-md bg-white/[0.04] px-3 py-1 text-[11px] text-white/50 mono">
                  <Command className="h-3 w-3" /> biology-ch12.pdf
                </div>
                <div className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-mint-500/25 bg-mint-500/[0.08] px-2 py-0.5 mono text-[10px] text-mint-300">
                  <span className="h-1 w-1 rounded-full bg-mint-400" /> gemini 2.0 flash
                </div>
              </div>
              <div className="grid md:grid-cols-[200px_1fr_260px] gap-0">
                <div className="p-4 border-r border-white/[0.05] space-y-1">
                  <div className="mono text-[10px] text-white/40 px-2 py-1">CONTENTS</div>
                  {[
                    { l: 'Notes',       a: true  },
                    { l: 'Key points',  a: false },
                    { l: 'Definitions', a: false },
                    { l: 'Flashcards',  a: false },
                    { l: 'Quiz',        a: false },
                    { l: 'Ask AI',      a: false },
                  ].map((t) => (
                    <div key={t.l} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] ${t.a ? 'bg-white/[0.05] text-white' : 'text-white/50'}`}>
                      {t.a && <span className="h-3 w-[2px] rounded-full bg-mint-400" />}
                      <span className={t.a ? '' : 'ml-[10px]'}>{t.l}</span>
                    </div>
                  ))}
                </div>
                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-4 w-[3px] rounded-full bg-mint-400" />
                    <div className="mono text-[13px] font-semibold text-white">Cellular respiration</div>
                  </div>
                  <div className="h-3 w-full rounded bg-white/[0.06]" />
                  <div className="h-3 w-[94%] rounded bg-white/[0.06]" />
                  <div className="h-3 w-[78%] rounded bg-white/[0.06]" />
                  <div className="flex items-center gap-2 mt-5">
                    <span className="inline-block h-4 w-[3px] rounded-full bg-mint-400" />
                    <div className="mono text-[13px] font-semibold text-white">Key stages</div>
                  </div>
                  <div className="pl-5 space-y-2">
                    <div className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-mint-400/70" /><div className="h-3 w-[80%] rounded bg-white/[0.055]" /></div>
                    <div className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-mint-400/70" /><div className="h-3 w-[64%] rounded bg-white/[0.055]" /></div>
                    <div className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-mint-400/70" /><div className="h-3 w-[72%] rounded bg-white/[0.055]" /></div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-mint-500/25 bg-mint-500/[0.05] p-3">
                      <div className="mono text-[10px] text-mint-400">FLASHCARD · 1/24</div>
                      <div className="mt-1 text-xs text-white/85">What is mitochondrial DNA?</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="mono text-[10px] text-white/40">FLASHCARD · 2/24</div>
                      <div className="mt-1 text-xs text-white/40">Tap to reveal</div>
                    </div>
                  </div>
                </div>
                <div className="hidden md:block border-l border-white/[0.05] p-4 flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-mint-500/10 border border-mint-500/25">
                      <Sparkles className="h-3 w-3 text-mint-400" />
                    </div>
                    <div className="mono text-[11px] text-white/60">Ask about pack</div>
                  </div>
                  <div className="rounded-xl bg-mint-500/[0.08] border border-mint-500/20 p-2.5 text-[11.5px] text-white/90 ml-6 mb-2">
                    Which stage produces most ATP?
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-2.5 text-[11.5px] text-white/75 mr-6">
                    <span className="text-mint-300">▸</span> The electron transport chain produces ~34 ATP, by far the largest yield…
                  </div>
                  <div className="mt-4 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] text-white/40 flex items-center justify-between">
                    Ask something…
                    <div className="h-5 w-5 rounded-md bg-mint-500/80" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="py-24 relative">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <div className="mono text-xs text-mint-400">// how it works</div>
          <h2 className="mt-3 mono text-4xl md:text-5xl font-semibold tracking-tightest text-white text-balance">
            Three steps. <span className="text-white/40">Zero busywork.</span>
          </h2>
        </motion.div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {HOW_STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="relative rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.025] to-transparent p-7 overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-mint-500/[0.06] blur-3xl" aria-hidden />
              <div className="relative">
                <div className="mono text-[44px] leading-none font-semibold text-white/15">{s.n}</div>
                <h3 className="mt-4 mono text-[18px] font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-[14px] text-white/55 leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <div className="mono text-xs text-mint-400">// capabilities</div>
          <h2 className="mt-3 mono text-4xl md:text-5xl font-semibold tracking-tightest text-white text-balance">
            One upload. <span className="text-white/40">Six outputs.</span>
          </h2>
          <p className="mt-4 text-white/60">Zero busywork. Every feature designed for students who actually want to learn, not skim.</p>
        </motion.div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassCard glow className="group h-full">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] group-hover:border-mint-500/40 group-hover:bg-mint-500/[0.08] transition-colors">
                  <f.icon className="h-5 w-5 text-white/70 group-hover:text-mint-400 transition-colors" />
                </div>
                <h3 className="mt-5 mono text-[15.5px] font-semibold text-white">{f.title}</h3>
                <p className="mt-1.5 text-[13.5px] text-white/55 leading-relaxed">{f.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProofStrip() {
  const facts = [
    { icon: Gauge,  label: '~20s',   hint: 'pack generation' },
    { icon: Layers, label: '30+',    hint: 'flashcards per pack' },
    { icon: Lock,   label: '0',      hint: 'cards required' },
    { icon: Zap,    label: 'Gemini', hint: '2.0 Flash inside' },
  ];
  return (
    <section className="py-8">
      <div className="mx-auto max-w-6xl px-6">
        <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-5 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-3">
          {facts.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-mint-500/20 bg-mint-500/[0.06]">
                <f.icon className="h-4.5 w-4.5 text-mint-400" />
              </div>
              <div>
                <div className="mono text-[18px] font-semibold text-white leading-tight">{f.label}</div>
                <div className="text-[11.5px] text-white/45 mono">{f.hint}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <div className="mono text-xs text-mint-400">// pricing</div>
          <h2 className="mt-3 mono text-4xl md:text-5xl font-semibold tracking-tightest text-white">
            Start free. <span className="text-white/40">Upgrade when it clicks.</span>
          </h2>
        </motion.div>

        <div className="mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
          <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
            <GlassCard className="h-full">
              <div className="mono text-xs text-white/50">FREE</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="mono text-5xl font-semibold text-white">$0</span>
                <span className="text-white/40 text-sm">/mo</span>
              </div>
              <ul className="mt-8 space-y-3">
                {free.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                    <Check className="mt-0.5 h-4 w-4 text-mint-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-8 block">
                <MotionButton variant="outline" className="w-full">Get started</MotionButton>
              </Link>
            </GlassCard>
          </motion.div>

          <motion.div whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
            <GlassCard className="relative h-full overflow-hidden border-mint-500/25 !bg-gradient-to-b from-mint-500/[0.08] to-white/[0.02]">
              <div className="absolute top-4 right-4 rounded-full border border-mint-500/30 bg-mint-500/[0.12] px-2 py-0.5 mono text-[10px] text-mint-300">RECOMMENDED</div>
              <div className="mono text-xs text-mint-400">PRO</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="mono text-5xl font-semibold text-white">$9</span>
                <span className="text-white/40 text-sm">/mo</span>
              </div>
              <ul className="mt-8 space-y-3">
                {pro.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                    <Check className="mt-0.5 h-4 w-4 text-mint-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-8 block">
                <MotionButton className="w-full">Go Pro</MotionButton>
              </Link>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-mint-500/25 bg-gradient-to-br from-mint-500/[0.10] via-mint-500/[0.04] to-transparent p-10 md:p-14 text-center"
        >
          <div className="absolute -top-20 -left-20 h-60 w-60 rounded-full bg-mint-500/[0.14] blur-3xl" aria-hidden />
          <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-mint-500/[0.10] blur-3xl" aria-hidden />
          <div className="relative">
            <div className="mono text-xs text-mint-300">// stop highlighting. start learning.</div>
            <h2 className="mt-3 mono text-3xl md:text-5xl font-semibold tracking-tightest text-white text-balance">
              Your next exam<br />
              <span className="bg-gradient-to-r from-mint-300 to-emerald-500 bg-clip-text text-transparent">starts with one upload.</span>
            </h2>
            <p className="mt-4 text-[15px] md:text-base text-white/65 max-w-xl mx-auto">
              No credit card. 10 free PDFs every day. Generate your first study pack in under a minute.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/signup"><MotionButton size="lg">Get started free <ArrowRight className="h-4 w-4" /></MotionButton></Link>
              <Link href="/login"><MotionButton size="lg" variant="outline">Log in</MotionButton></Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (<><Hero /><ProofStrip /><HowItWorks /><Features /><Pricing /><FinalCTA /></>);
}
