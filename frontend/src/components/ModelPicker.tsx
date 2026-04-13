import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Cpu, Zap, Feather, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type ModelId =
  | 'gemini-2.5-pro'
  | 'gemini-2.0-flash'
  | 'groq-llama-3.3-70b'
  | 'groq-llama-3.1-8b'
  | 'openrouter-deepseek'
  | 'mistral-small';

export interface ModelOption {
  id: ModelId;
  name: string;
  provider: string;
  blurb: string;
  tier: 'flagship' | 'fast' | 'balanced';
}

export const MODELS: ModelOption[] = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', blurb: 'Best reasoning. Default.', tier: 'flagship' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', blurb: 'Fast, reliable JSON.', tier: 'fast' },
  { id: 'groq-llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'Groq', blurb: 'Fastest inference.', tier: 'balanced' },
  { id: 'groq-llama-3.1-8b', name: 'Llama 3.1 8B', provider: 'Groq', blurb: 'Lightweight, quick.', tier: 'fast' },
  { id: 'openrouter-deepseek', name: 'DeepSeek V3', provider: 'OpenRouter', blurb: 'Strong free-tier reasoning.', tier: 'flagship' },
  { id: 'mistral-small', name: 'Mistral Small', provider: 'Mistral', blurb: 'Compact, precise.', tier: 'balanced' },
];

const tierIcon = {
  flagship: Sparkles,
  fast: Zap,
  balanced: Feather,
};

export function ModelPicker({ value, onChange, disabled }: { value: ModelId; onChange: (v: ModelId) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = MODELS.find((m) => m.id === value) ?? MODELS[0];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const Icon = tierIcon[selected.tier];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition-colors cursor-pointer',
          'hover:border-white/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500/30',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
            <Icon className="h-4 w-4 text-mint-400" />
          </div>
          <div className="min-w-0">
            <div className="mono text-[11px] text-white/40">MODEL · {selected.provider.toUpperCase()}</div>
            <div className="text-sm font-medium text-white truncate">{selected.name}</div>
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-white/[0.10] bg-ink-800/95 backdrop-blur-xl shadow-glass"
          >
            <div className="p-1 max-h-[320px] overflow-y-auto">
              {MODELS.map((m) => {
                const TIcon = tierIcon[m.tier];
                const isSel = m.id === value;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { onChange(m.id); setOpen(false); }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer',
                      isSel ? 'bg-mint-500/[0.08]' : 'hover:bg-white/[0.04]',
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
                      <TIcon className={cn('h-3.5 w-3.5', isSel ? 'text-mint-400' : 'text-white/60')} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-medium', isSel ? 'text-mint-300' : 'text-white')}>{m.name}</span>
                        <span className="mono text-[10px] text-white/40">{m.provider}</span>
                      </div>
                      <div className="text-xs text-white/50">{m.blurb}</div>
                    </div>
                    {isSel && <Check className="h-4 w-4 text-mint-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-white/[0.05] px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                <Cpu className="h-3 w-3" />
                <span className="mono">auto-fallback if rate-limited</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
