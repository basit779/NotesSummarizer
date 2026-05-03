# StudySnap — Next.js App

The active deployable. Single Next.js project — frontend + serverless API + Inngest background queue — runs on Vercel Hobby for $0/mo.

For the full architecture write-up, see the [root README](../README.md).

---

## Stack

- **Next.js 15** App Router (frontend + serverless API)
- **Tailwind + Framer Motion** (dark, cinematic UI)
- **Prisma + Postgres** (Neon in prod, docker compose locally)
- **Inngest** background queue + per-step orchestration
- **Multi-provider AI auto-fallback:**
  - `gemini-2.5-flash` (free primary)
  - `deepseek-v4-flash` (paid backup, 2-pass parallel for medium+ docs)
  - `groq-llama-3.3-70b` (LPU safety net)
  - `mistral-small` (last resort)
- **JWT auth + bcrypt**
- **Stripe billing** (mock by default, real via `BILLING_MODE=live`)
- **RAG chat** with Gemini `text-embedding-004`

---

## Local quick start

```bash
# 1. Postgres
cd ..
docker compose up -d

# 2. Configure
cd studysnap-next
cp .env.example .env.local
# edit .env.local — minimum required:
#   - JWT_SECRET (any random string)
#   - DATABASE_URL
#   - one AI key (GOOGLE_API_KEY recommended; DEEPSEEK_API_KEY for paid pipeline)

# 3. Install + migrate
npm install
npx prisma migrate dev --name init

# 4. Run
npm run dev                       # → http://localhost:3000

# 5. (optional) Inngest dev server in another terminal
npx inngest-cli@latest dev        # → http://localhost:8288
```

The Inngest CLI dev server discovers your `process-file` function at `http://localhost:3000/api/inngest` and gives you a local dashboard at `http://localhost:8288` for inspecting runs.

---

## Deploy to Vercel

1. Push this folder (or the parent repo) to GitHub
2. Import on vercel.com — Framework preset: **Next.js** (auto-detected)
3. Set env vars from `.env.example`. `DATABASE_URL` should point to a hosted Postgres (Neon free tier works)
4. Set `NEXT_PUBLIC_APP_URL` to your custom Vercel domain
5. Deploy. First deploy runs `prisma generate && prisma db push && next build`
6. Run migrations once: `npx prisma migrate deploy` against your prod `DATABASE_URL`

### Inngest setup (one-time)

Inngest is required for the AI pipeline to run.

1. Sign up at [inngest.com](https://www.inngest.com/) — sign in with GitHub
2. **Settings → Integrations → Vercel → Connect**. Auto-installs `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` env vars on your Vercel project
3. **Critical:** Inngest dashboard → **Integrations → Vercel → Configure** on your project → set **Custom Production Domain** to your Vercel custom domain (e.g. `yourapp.vercel.app`). Without this, Inngest tries to sync via the preview-style deployment URL which is blocked by Vercel SSO → 401 errors → "Unattached syncs" in the Inngest dashboard
4. Trigger a fresh Vercel deploy — Inngest discovers the `process-file` function at `/api/inngest` automatically

Verify: Inngest dashboard → Apps → you should see `studysnap` listed with `process-file` synced (green status).

---

## Project layout

```
studysnap-next/
├── app/
│   ├── api/
│   │   ├── auth/{signup,login,me}/route.ts
│   │   ├── upload/route.ts                  # in-memory PDF upload
│   │   ├── process/[fileId]/route.ts        # enqueues Inngest event, returns 202
│   │   ├── process/[fileId]/status/route.ts # client polls this
│   │   ├── inngest/route.ts                 # Inngest webhook handler (serve())
│   │   ├── chat/route.ts                    # RAG chat
│   │   ├── history/, results/, dashboard/, health/
│   │   └── stripe/{checkout,subscription-status,webhook}/route.ts
│   ├── (pages)/                             # Landing, Auth, Dashboard, Upload, Results, History, Billing
│   ├── layout.tsx
│   └── globals.css
├── components/                              # Navbar, Flashcard, ModelPicker, MarkdownView, fx/, ui/
├── lib/
│   ├── inngest.ts                           # Inngest client + processFile orchestrator
│   ├── ai/
│   │   ├── providers/{gemini,openaiCompat}.ts
│   │   ├── registry.ts                      # provider chain + per-provider config
│   │   ├── runWithFallback.ts               # legacy chain runner (chat path) + runOneProvider helper
│   │   ├── twoPass.ts                       # dead-path; merge logic ported into lib/inngest.ts
│   │   ├── chunked.ts                       # >120K char path
│   │   ├── ragIndex.ts, retrieval.ts, embeddings.ts
│   │   └── schema.ts, truncate.ts, telemetry.ts, pdfCache.ts, errorClassify.ts
│   ├── client/                              # browser-side api + zustand auth store
│   ├── apiHelpers.ts                        # requireAuth, withErrorHandling, signToken
│   └── env.ts, prisma.ts, pdf.ts, prompts.ts, validators.ts, usage.ts
└── prisma/schema.prisma
```

---

## How the AI pipeline works

1. Browser uploads PDF → `app/api/upload/route.ts` saves to in-memory base64 in Postgres
2. Browser POSTs `/api/process/:fileId` → route returns **202 + jobId in <1s**, fires `inngest.send({ name: 'process.file', ... })`
3. Inngest webhook hits `/api/inngest` → invokes `processFile` orchestrator
4. Orchestrator runs as steps (each its own 60s Vercel function invocation):
   - `load-file` — DB lookup
   - `extract-text` — pdf-parse or mammoth
   - **Analyze branch:**
     - Short doc (<5K chars): single-pass per-provider chain
     - Medium+ doc: chain loop where DeepSeek runs **2-pass parallel** (`pass1` + `pass2` as separate steps via `Promise.all([step.run(...), step.run(...)])`)
   - `persist-result` — DB writes + usage log
   - `cache-and-rag` — PdfCache + buildRagIndex (Gemini embeddings)
5. Browser polls `/api/process/:fileId/status` → sees `done`, fetches result

The 2-pass parallel is what makes DeepSeek (50-80 tok/s) actually finish a full pack on Vercel Hobby's 60s wall — each pass only generates ~3K tokens, fits 55s timeout, both succeed → merge → full-quality pack.

---

## Environment

See [.env.example](.env.example) for the full template with sources.

Required minimum:
- `DATABASE_URL`
- `JWT_SECRET`
- One AI key: `GOOGLE_API_KEY` / `DEEPSEEK_API_KEY` / `GROQ_API_KEY` / `MISTRAL_API_KEY`

Auto-set by Vercel integrations:
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` (set by Inngest's Vercel integration)
- `STRIPE_*` (only needed when `BILLING_MODE=live`)

Defaults:
- `BILLING_MODE=mock` (no real payments)
- `FREE_DAILY_UPLOAD_LIMIT=5`
- `MAX_UPLOAD_MB=15`

---

## Verification

```bash
# Local API health
curl http://localhost:3000/api/health
# → {"ok":true,"service":"studysnap-api"}

# Inngest endpoint reachable
curl http://localhost:3000/api/inngest
# → {"message":"Unauthorized"}   (expected — endpoint alive, just rejects unsigned GET)
```

End-to-end: signup → /upload → drop a small PDF → see `process-file` run appear in `http://localhost:8288` (local Inngest dashboard) → step timeline → pack delivered.

---

## Differences from legacy Express version

The parent repo also has `frontend/` (Vite + React) and `backend/` (Express). Those are the older split architecture — kept for reference but **not deployed**. The Next.js app you're looking at is what runs in production.

Key differences:
- **No disk storage.** PDFs uploaded into memory, base64-stored briefly, processed, then cleared. Works on Vercel's read-only filesystem
- **Same-origin API.** No CORS, frontend uses `fetch('/api/...')`
- **Inngest replaces in-process queue.** Old Express version had a custom `runSerial` per-user lock; Inngest's durable concurrency keys replaced that
- **2-pass DeepSeek.** Only the Next.js + Inngest version has this — required Inngest's per-step orchestration to work
