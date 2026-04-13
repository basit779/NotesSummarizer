import { useState } from 'react';
import { cn } from '@/lib/utils';

export function Flashcard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((f) => !f)}
      className={cn(
        'group relative h-48 w-full rounded-xl border bg-card p-6 text-left transition-all hover:border-primary/50 card-glow',
      )}
    >
      <div className="absolute top-3 right-4 text-xs text-muted-foreground">
        {flipped ? 'Answer' : 'Question — click to flip'}
      </div>
      <div className="mt-4 text-base font-medium leading-relaxed">
        {flipped ? back : front}
      </div>
    </button>
  );
}
