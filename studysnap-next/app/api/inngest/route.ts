import { serve } from 'inngest/next';
import { inngest, inngestFunctions } from '@/lib/inngest';

export const runtime = 'nodejs';
// Fluid Compute is ENABLED on this project (confirmed 2026-07-27), which
// lifts Hobby's function ceiling from 60s to 300s. Every Inngest step runs
// inside an invocation of this route, so this is THE ceiling for the whole
// pipeline. All step-level timeouts in lib/inngest.ts are sized well inside
// it (90s DeepSeek passes, 240s chunked) — no step should ever ride the wall
// again. If this ever 504s at ~60s, Fluid got disabled; re-enable it in
// Vercel → Settings → Functions.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
