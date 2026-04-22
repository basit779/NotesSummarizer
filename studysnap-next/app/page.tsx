'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import {
  Brain, Target, Zap, FileText, Sparkles, Check, ArrowRight, Command,
  MessageSquare, Layers, Gauge, Lock,
} from 'lucide-react';
import { MotionButton } from '@/components/ui/MotionButton';
import { StudySnapLogo } from '@/components/brand/StudySnapLogo';
import { cn } from '@/lib/utils';
import { TiltCard } from '@/components/ui/TiltCard';
import { MouseGlow } from '@/components/ui/MouseGlow';

// ————————————————————————————————————————————————————————————————
// Primitives
// ————————————————————————————————————————————————————————————————

function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Performant Aurora using soft radial gradients and transform-gpu */}
      <div className="absolute inset-[-50%] mix-blend-screen animate-aurora transform-gpu"
           style={{
             backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(52, 211, 153, 0.05) 0%, transparent 40%), radial-gradient(circle at 20% 80%, rgba(4, 120, 87, 0.1) 0%, transparent 50%)',
             backgroundSize: '150% 150%',
           }}
      />
      {/* Ambient top light */}
      <div className="absolute top-0 inset-x-0 h-[60vh] bg-gradient-to-b from-mint-500/[0.04] via-mint-500/[0.01] to-transparent" />
    </div>
  );
}

function MockupFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 w-full max-w-[1000px] mx-auto perspective-1000 mt-20">
      <motion.div 
        initial={{ rotateX: 15, scale: 0.95, opacity: 0, y: 50 }}
        animate={{ rotateX: 0, scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 100, delay: 0.2 }}
        className="relative overflow-hidden rounded-2xl bg-white/[0.02] p-1 backdrop-blur-3xl shadow-[0_40px_100px_-20px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/[0.05] border-t-white/[0.15]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-mint-500/10 via-transparent to-transparent opacity-50" />
        <div className="relative z-10 overflow-hidden rounded-xl bg-ink-950/90 shadow-2xl ring-1 ring-white/[0.05]">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Data
// ————————————————————————————————————————————————————————————————

const features = [
  { icon: Brain,         title: 'Structured Notes',   desc: 'Markdown-formatted study notes with headings, bullets, examples — not a wall of prose.' },
  { icon: Target,        title: 'Exam Questions',     desc: 'MCQs with 4 options, correct answer, and explanation that grades why distractors are wrong.' },
  { icon: Zap,           title: 'Flashcards',         desc: '22-40 cards per pack, spaced-repetition ready, CSV export for Anki.' },
  { icon: FileText,      title: 'Every Definition',   desc: 'Ten+ precise definitions per pack. No glossary gaps, no jargon left unexplained.' },
  { icon: MessageSquare, title: 'Chat With Your PDF', desc: 'Ask questions about the exact document you uploaded. Grounded answers, zero hallucinations.' },
  { icon: Layers,        title: 'Multi-Model AI',     desc: 'Gemini 2.0 Flash primary, Groq Llama and OpenRouter fallback. Never locked to one vendor.' },
];

const HOW_STEPS = [
  { n: '01', title: 'Drop a PDF',   desc: 'Any lecture slide, textbook chapter, or research paper up to 15 MB.' },
  { n: '02', title: 'AI extracts it',  desc: 'Gemini 2.0 Flash extracts every concept, term, and testable fact in ~20 seconds.' },
  { n: '03', title: 'Study faster', desc: 'Structured notes, flashcards, quiz, definitions. Plus an AI tutor grounded in your document.' },
];

// ————————————————————————————————————————————————————————————————
// Sections
// ————————————————————————————————————————————————————————————————

function Hero() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15, ease: "easeOut" }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <section className="relative min-h-[90vh] flex flex-col items-center pt-32 pb-20 overflow-hidden">
      <Glow />
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full max-w-6xl px-6 text-center"
      >
        <motion.div variants={item} className="mb-8 flex justify-center">
          <Link
            href="/"
            className="group relative inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2 backdrop-blur-md transition-all hover:bg-white/[0.08] hover:border-mint-500/30"
          >
            <StudySnapLogo size={24} />
            <span className="bg-gradient-to-r from-white/90 to-white/50 bg-clip-text text-sm font-medium tracking-tight text-transparent">
              StudySnap is evolving.
            </span>
            <div className="absolute inset-0 rounded-full shadow-[0_0_20px_rgba(16,185,129,0)_inset] transition-shadow duration-500 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)_inset]" />
          </Link>
        </motion.div>

        <motion.h1 variants={item} className="mx-auto max-w-4xl text-6xl md:text-8xl font-bold tracking-tighter text-white" style={{ textShadow: '0 4px 40px rgba(255,255,255,0.1)' }}>
          Study at the speed <br className="hidden md:block"/>
          <span className="inline-block bg-gradient-to-r from-mint-300 via-mint-400 to-emerald-500 bg-clip-text text-transparent transform md:-rotate-1" style={{ filter: 'drop-shadow(0 0 40px rgba(16,185,129,0.25))' }}>
            of thought.
          </span>
        </motion.h1>

        <motion.p variants={item} className="mx-auto mt-8 max-w-2xl text-lg md:text-xl text-white/50 font-light tracking-wide leading-relaxed">
          Drop a PDF. Get exam-ready notes, flashcards, quizzes, and an AI tutor grounded in your document. Built for elite students who move fast.
        </motion.p>

        <motion.div variants={item} className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/signup">
            <MotionButton size="lg" className="rounded-full px-8 py-6 text-base shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)]">
              Start Free <ArrowRight className="ml-2 h-4 w-4" />
            </MotionButton>
          </Link>
          <Link href="/login">
            <MotionButton size="lg" variant="ghost" className="rounded-full px-8 py-6 text-base border border-white/5 bg-white/5 hover:bg-white/10 backdrop-blur-lg">
              I have an account
            </MotionButton>
          </Link>
        </motion.div>
        
        <MockupFrame>
          <div className="w-full flex flex-col h-[600px]">
            {/* Top Bar */}
            <div className="flex h-12 items-center gap-4 border-b border-white/[0.05] bg-white/[0.01] px-4">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-white/10 hover:bg-rose-500/50 transition-colors" />
                <div className="h-3 w-3 rounded-full bg-white/10 hover:bg-amber-500/50 transition-colors" />
                <div className="h-3 w-3 rounded-full bg-white/10 hover:bg-emerald-500/50 transition-colors" />
              </div>
              <div className="mx-auto flex h-6 w-64 items-center justify-center rounded-md bg-white/[0.03] text-xs text-white/40 font-mono tracking-wider border border-white/[0.05]">
                biology_ch12_respiration.pdf
              </div>
            </div>
            {/* Body */}
            <div className="flex flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.05),transparent)]">
              {/* Sidebar */}
              <div className="w-64 border-r border-white/[0.05] bg-white/[0.01] p-4 flex flex-col gap-2">
                {['Notes', 'Flashcards', 'Quizzes', 'Definitions', 'Chat'].map((item, i) => (
                  <div key={item} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all group flex items-center gap-3 cursor-pointer", i === 0 ? "bg-mint-500/10 text-mint-400 border border-mint-500/20" : "text-white/40 hover:bg-white/[0.05] hover:text-white/80")}>
                    <div className={cn("h-1.5 w-1.5 rounded-full", i === 0 ? "bg-mint-400" : "bg-white/20 group-hover:bg-white/60")} />
                    {item}
                  </div>
                ))}
              </div>
              {/* Content area */}
              <div className="flex-1 p-8 overflow-hidden relative">
                 <div className="text-sm font-mono text-mint-400 mb-4 tracking-widest uppercase opacity-80 z-10 relative">Generated Note</div>
                 <div className="text-3xl font-bold text-white mb-6 z-10 relative tracking-tight">Cellular Respiration</div>
                 
                 <div className="space-y-4 max-w-2xl relative z-10">
                   {[90, 80, 85, 70, 95].map((w, i) => (
                     <div key={i} className="flex gap-4">
                       <div className="h-4 w-4 rounded-sm bg-mint-500/20 mt-1 shrink-0 border border-mint-500/30" />
                       <div className="h-4 rounded bg-white/[0.06] backdrop-blur-sm" style={{ width: `${w}%` }} />
                     </div>
                   ))}
                 </div>

                 {/* Decorative background grid */}
                 <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)] pointer-events-none" />
              </div>
            </div>
          </div>
        </MockupFrame>
      </motion.div>
    </section>
  );
}

function ProofStrip() {
  const facts = [
    { icon: Gauge,  label: '~20s',   hint: 'Processing Time' },
    { icon: Layers, label: '30+',    hint: 'Flashcards per pack' },
    { icon: Lock,   label: '0',      hint: 'Required Setup' },
    { icon: Zap,    label: 'Gemini', hint: '2.0 Flash Engine' },
  ];

  return (
    <section className="py-12 border-y border-white/[0.05] bg-white/[0.01] relative z-10 mt-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
          {facts.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="flex items-center justify-center gap-4 py-4 md:py-0"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-500/10 border border-mint-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                 <f.icon className="h-5 w-5 text-mint-400" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-2xl font-mono font-bold text-white">{f.label}</span>
                <span className="text-xs text-white/40 uppercase tracking-widest">{f.hint}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="py-32 relative z-10">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] mb-6">
            <span className="h-2 w-2 rounded-full bg-mint-400 animate-pulse" />
            <span className="text-xs font-mono tracking-widest uppercase text-white/60">Flow</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
            Three steps. <br/> <span className="text-white/30">Zero busywork.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {HOW_STEPS.map((s, i) => (
            <TiltCard key={s.n} className="h-[300px]">
              <div className="absolute -top-10 -right-10 text-[180px] font-bold text-white/[0.02] font-mono leading-none pointer-events-none select-none z-0">
                {s.n}
              </div>
              <div className="relative z-10 flex flex-col h-full justify-end">
                <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">{s.title}</h3>
                <p className="text-white/50 leading-relaxed text-sm">{s.desc}</p>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-32 relative z-10 bg-ink-900 border-t border-white/[0.05]">
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-mint-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="mx-auto max-w-6xl px-6 relative z-10">
        <div className="grid md:grid-cols-2 gap-16 items-center mb-24">
           <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
                 One PDF. <br className="hidden md:block"/>
                 <span className="bg-gradient-to-r from-emerald-400 to-mint-400 bg-clip-text text-transparent">Complete Arsenal.</span>
              </h2>
              <p className="text-lg text-white/50 leading-relaxed max-w-md">
                 Everything you need to master your material is extracted instantly. Stop highlighting. Start learning.
              </p>
           </div>
           <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
              {features.map((f, i) => (
                 <motion.div
                   key={f.title}
                   initial={{ opacity: 0, scale: 0.95 }}
                   whileInView={{ opacity: 1, scale: 1 }}
                   viewport={{ once: true, margin: '-50px' }}
                   transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
                   className="group relative flex flex-col p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors"
                 >
                    <div className="mb-4 h-12 w-12 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center group-hover:scale-110 group-hover:border-mint-500/30 group-hover:bg-mint-500/10 transition-all duration-300">
                       <f.icon className="h-5 w-5 text-white/50 group-hover:text-mint-400 transition-colors" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
                 </motion.div>
              ))}
           </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const free = ['10 PDF uploads / day', 'Markdown notes', 'Flashcards & definitions', 'Basic Quiz mode'];
  const pro = ['Unlimited PDF uploads', 'Priority fast processing', 'Advanced exam questions', 'Export to Anki CSV', 'Priority multi-model AI'];

  return (
    <section id="pricing" className="py-32 relative z-10 overflow-hidden">
      <div className="mx-auto max-w-5xl px-6 relative">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Start Free. <span className="text-white/40">Scale up.</span>
          </h2>
          <p className="text-white/50">Generous limits forever. Superpowers when you need them.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
          
          <TiltCard glowOpacity={0.05} className="h-full">
            <div className="flex flex-col h-full">
               <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-2">Student Tier</div>
               <div className="flex items-end gap-2 mb-8">
                  <span className="text-5xl font-bold text-white">$0</span>
                  <span className="text-white/40 mb-1">/ month</span>
               </div>
               <ul className="space-y-4 mb-10 flex-1">
                 {free.map(f => (
                   <li key={f} className="flex items-center gap-3 text-sm text-white/60">
                      <Check className="h-4 w-4 text-white/20" /> {f}
                   </li>
                 ))}
               </ul>
               <Link href="/signup">
                  <MotionButton variant="outline" className="w-full h-12 rounded-xl border border-white/10 hover:bg-white/5 hover:border-white/20 text-white">Get Started</MotionButton>
               </Link>
            </div>
          </TiltCard>

          <TiltCard glowOpacity={0.2} className="relative h-full ring-1 ring-mint-500/30">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-mint-500/[0.08] to-transparent pointer-events-none" />
            <div className="absolute top-4 right-4 border border-mint-500/50 bg-mint-500/10 px-3 py-1 rounded-full text-[10px] font-mono tracking-widest text-mint-400 uppercase">
              Pro
            </div>
            <div className="flex flex-col h-full relative z-10">
               <div className="text-xs font-mono uppercase tracking-widest text-mint-400 mb-2">Scholar Tier</div>
               <div className="flex items-end gap-2 mb-8">
                  <span className="text-5xl font-bold text-white">$9</span>
                  <span className="text-white/40 mb-1">/ month</span>
               </div>
               <ul className="space-y-4 mb-10 flex-1">
                 {pro.map(f => (
                   <li key={f} className="flex items-center gap-3 text-sm text-white/80">
                      <div className="flex h-5 w-5 rounded-full items-center justify-center bg-mint-500/20">
                         <Check className="h-3 w-3 text-mint-400" />
                      </div>
                      {f}
                   </li>
                 ))}
               </ul>
               <Link href="/signup">
                  <MotionButton className="w-full h-12 rounded-xl shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)]">Go Pro</MotionButton>
               </Link>
            </div>
          </TiltCard>

        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-32 relative z-10 flex justify-center">
      <TiltCard className="max-w-4xl w-full text-center p-12 md:p-20 relative overflow-hidden" glowOpacity={0.3}>
         <div className="absolute inset-0 bg-gradient-to-tr from-mint-500/10 via-transparent to-emerald-500/10" />
         <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
              A smarter way to study <br/> is one click away.
            </h2>
            <p className="text-lg text-white/60 mb-10 max-w-xl mx-auto">
              Stop re-reading and start testing yourself. 10 free uploads a day, every day.
            </p>
            <Link href="/signup">
               <MotionButton size="lg" className="rounded-full px-10 py-6 text-lg hover:scale-105 transition-transform">
                  Upload your first PDF
               </MotionButton>
            </Link>
         </div>
      </TiltCard>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-950 font-sans selection:bg-mint-500/30">
      <MouseGlow />
      <Hero />
      <ProofStrip />
      <HowItWorks />
      <Features />
      <Pricing />
      <FinalCTA />
    </div>
  );
}
