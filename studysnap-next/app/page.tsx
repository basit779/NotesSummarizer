'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Brain, Target, Zap, FileText, BookOpen, Sparkles, Check, ArrowRight, Command } from 'lucide-react';
import { MotionButton } from '@/components/ui/MotionButton';
import { GlassCard } from '@/components/ui/GlassCard';

const features = [
  { icon: Brain, title: 'Smart summaries', desc: 'Dense, exam-focused. Skips filler. Keeps the signal.' },
  { icon: Target, title: 'Exam questions', desc: 'Realistic practice at every difficulty tier.' },
  { icon: Zap, title: 'Flashcards', desc: 'Spaced-repetition ready from any PDF.' },
  { icon: FileText, title: 'Key definitions', desc: 'Every critical term, organized and searchable.' },
  { icon: BookOpen, title: 'Revision sheets', desc: "One-pagers you'll actually re-read." },
  { icon: Sparkles, title: 'Multi-model AI', desc: 'Pick your engine. Gemini, Llama, DeepSeek.' },
];

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const mockY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const mockOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);
  const headline = ['Study', 'at', 'the', 'speed', 'of', 'thought.'];

  return (
    <section ref={ref} className="relative pt-32 pb-16 md:pt-40 md:pb-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/70"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-mint-500/60" />
            <span className="relative rounded-full bg-mint-500 h-1.5 w-1.5" />
          </span>
          <span className="mono">v1.0 · now in public beta</span>
        </motion.div>

        <h1 className="mt-8 mono text-[44px] leading-[1.05] tracking-tightest font-semibold text-white md:text-[84px] text-balance">
          {headline.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block mr-[0.22em]"
            >
              {word === 'thought.' ? <span className="text-mint-400">{word}</span> : word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-6 max-w-xl text-lg text-white/60 text-balance"
        >
          Drop a PDF. Get summaries, flashcards, definitions, and exam questions. Built for students who move fast.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          <Link href="/signup"><MotionButton size="lg">Start free <ArrowRight className="h-4 w-4" /></MotionButton></Link>
          <Link href="/login"><MotionButton size="lg" variant="outline">I have an account</MotionButton></Link>
          <span className="mono text-xs text-white/40 ml-1">no card · 3 uploads/day free</span>
        </motion.div>

        <motion.div
          style={{ y: mockY, opacity: mockOpacity }}
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-20 md:mt-24 mx-auto max-w-4xl"
        >
          <div className="relative">
            <div className="absolute -inset-8 bg-mint-500/[0.08] blur-3xl rounded-full" />
            <GlassCard className="relative !p-0 overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.05]">
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="ml-3 flex items-center gap-2 rounded-md bg-white/[0.04] px-3 py-1 text-[11px] text-white/50 mono">
                  <Command className="h-3 w-3" /> biology-ch12.pdf
                </div>
              </div>
              <div className="grid md:grid-cols-[1fr_1.4fr] gap-0">
                <div className="p-5 border-r border-white/[0.05] space-y-3">
                  {['Summary', 'Key points', 'Flashcards', 'Exam questions', 'Definitions'].map((t, i) => (
                    <div key={t} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${i === 0 ? 'bg-mint-500/[0.08] text-mint-300 border border-mint-500/20' : 'text-white/50'}`}>
                      <span>{t}</span>
                      {i === 0 && <div className="h-1.5 w-1.5 rounded-full bg-mint-400" />}
                    </div>
                  ))}
                </div>
                <div className="p-6 space-y-3">
                  <div className="h-2 w-24 rounded bg-white/[0.08]" />
                  <div className="h-3 w-full rounded bg-white/[0.06]" />
                  <div className="h-3 w-[90%] rounded bg-white/[0.06]" />
                  <div className="h-3 w-[70%] rounded bg-white/[0.06]" />
                  <div className="h-2 w-32 rounded bg-white/[0.08] mt-6" />
                  <div className="h-3 w-full rounded bg-white/[0.06]" />
                  <div className="h-3 w-[85%] rounded bg-white/[0.06]" />
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-mint-500/20 bg-mint-500/[0.04] p-3">
                      <div className="mono text-[10px] text-mint-400">FLASHCARD · 1/12</div>
                      <div className="mt-1 text-xs text-white/80">What is mitochondrial DNA?</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="mono text-[10px] text-white/40">FLASHCARD · 2/12</div>
                      <div className="mt-1 text-xs text-white/50">Tap to reveal</div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </motion.div>
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

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassCard glow className="group h-full">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] group-hover:border-mint-500/40 group-hover:bg-mint-500/[0.06] transition-colors">
                  <f.icon className="h-5 w-5 text-white/70 group-hover:text-mint-400 transition-colors" />
                </div>
                <h3 className="mt-5 mono text-[15px] font-semibold text-white">{f.title}</h3>
                <p className="mt-1.5 text-sm text-white/55 leading-relaxed">{f.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const free = ['3 PDF uploads / day', 'Summaries & flashcards', 'Exam questions', 'Community support'];
  const pro = ['Unlimited uploads', 'Priority processing', 'Advanced question generation', 'Flashcard CSV export', 'Priority AI models'];

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
            <GlassCard className="relative h-full overflow-hidden border-mint-500/25 !bg-gradient-to-b from-mint-500/[0.06] to-white/[0.02]">
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

export default function LandingPage() {
  return (<><Hero /><Features /><Pricing /></>);
}
