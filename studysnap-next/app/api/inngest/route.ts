import { serve } from 'inngest/next';
import { inngest, inngestFunctions } from '@/lib/inngest';

export const runtime = 'nodejs';
// Lift the per-step ceiling as high as Vercel allows on this plan. Hobby
// caps at 60s regardless; on Pro the analyze step gets the full 300s.
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
