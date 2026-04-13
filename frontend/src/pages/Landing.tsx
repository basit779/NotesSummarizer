import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, BookOpen, Brain, Target, Zap, FileText, Check } from 'lucide-react';

const features = [
  { icon: Brain, title: 'Smart Summaries', desc: 'Dense, exam-focused summaries that skip the fluff.' },
  { icon: Target, title: 'Exam Questions', desc: 'Realistic practice questions at varying difficulty.' },
  { icon: Zap, title: 'Flashcards', desc: 'Spaced-repetition-ready cards from any PDF.' },
  { icon: FileText, title: 'Key Definitions', desc: 'Every critical term, defined and organized.' },
  { icon: BookOpen, title: 'Revision Sheets', desc: 'Condensed one-pagers you\'ll actually re-read.' },
  { icon: Sparkles, title: 'Claude-powered', desc: 'State-of-the-art AI, structured JSON output.' },
];

export default function Landing() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-[0.08]" />
        <div className="container relative py-24 md:py-32 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-medium">
            <Sparkles className="h-3 w-3 text-primary" />
            Powered by Claude — Structured AI output
          </div>
          <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight">
            Turn 10 hours of studying<br /> into <span className="gradient-text">1 hour</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Upload any PDF — lecture notes, textbook chapters, research papers — and get summaries,
            flashcards, key concepts, and exam questions in seconds.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/signup"><Button variant="gradient" size="lg">Start for free</Button></Link>
            <Link to="/login"><Button variant="outline" size="lg">I already have an account</Button></Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required · 3 free uploads per day</p>
        </div>
      </section>

      <section className="container py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Everything you need to ace your exams</h2>
          <p className="mt-3 text-muted-foreground">One upload. Six outputs. Zero busywork.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {features.map((f) => (
            <Card key={f.title} className="transition-all hover:border-primary/40 hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-hero">
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Simple pricing</h2>
          <p className="mt-3 text-muted-foreground">Start free. Upgrade when you need more.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Card>
            <CardContent className="p-8">
              <h3 className="font-semibold text-lg">Free</h3>
              <div className="mt-3 text-4xl font-bold">$0<span className="text-base font-normal text-muted-foreground">/mo</span></div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> 3 PDF uploads / day</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Standard summaries & flashcards</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Exam questions</li>
              </ul>
              <Link to="/signup" className="block mt-8"><Button variant="outline" className="w-full">Get started</Button></Link>
            </CardContent>
          </Card>
          <Card className="card-glow border-primary/40">
            <CardContent className="p-8">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">Pro</h3>
                <span className="rounded-full bg-gradient-hero px-2 py-0.5 text-xs font-medium text-white">Recommended</span>
              </div>
              <div className="mt-3 text-4xl font-bold gradient-text">$9<span className="text-base font-normal text-muted-foreground">/mo</span></div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited uploads</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Faster processing</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Advanced exam questions</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Flashcard export</li>
              </ul>
              <Link to="/signup" className="block mt-8"><Button variant="gradient" className="w-full">Go Pro</Button></Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
