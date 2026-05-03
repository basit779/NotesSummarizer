# StudySnap AI

**Drop a PDF, get a study pack.** Summary, key points, definitions, flashcards, exam questions, plus chat-with-your-doc — all in seconds.

Live at **[studysnap-cyan.vercel.app](https://studysnap-cyan.vercel.app)**.

---

## What's interesting under the hood

This isn't another "wrap GPT in Next.js" project. The AI pipeline survives Vercel Hobby's 60-second function cap while still using a **paid 50-80 tok/s model** that physically can't finish a study pack in 60s under normal architecture. The trick:

1. **Inngest as a background queue.** The Vercel route returns `202 + jobId` in <1s, then Inngest fires the work as a separate webhook. Browser doesn't hang.
2. **Per-provider Inngest steps.** Each AI provider attempt runs in its own Vercel function invocation = its own 60s budget. Failures cleanly cascade to the next provider without losing the upload.
3. **Parallel 2-pass DeepSeek for medium+ docs.** When the chain reaches DeepSeek and the doc is bigger than a few pages, the pipeline splits the pack into pass1 (summary + keyPoints + definitions) and pass2 (flashcards + MCQs + tips), runs both as **parallel Inngest steps**, and merges the halves. Each parallel step generates ~3K tokens (≤55s on DeepSeek's hardware), so the full pack actually finishes on Hobby.

Result: a $4 DeepSeek budget that actively serves packs at any doc size on a free Vercel plan.

---

## Stack

- **Next.js 15** App Router — single project, frontend + serverless API routes
- **Tailwind + Framer Motion** — dark, cinematic UI
- **Prisma + Postgres** — Neon free tier in prod, docker compose locally
- **Inngest** — background queue + per-step orchestration (free tier)
- **AI providers (auto-fallback chain):**
  1. `gemini-2.5-flash` — free primary, ~80% of uploads
  2. `deepseek-v4-flash` — paid backup with 2-pass parallel for medium+ docs
  3. `groq-llama-3.3-70b` — LPU safety net (~15s)
  4. `mistral-small` — last resort
- **JWT auth + bcrypt**
- **Stripe** — mock mode by default ($0 dev), `BILLING_MODE=live` for real
- **RAG chat** — Gemini `text-embedding-004`, Postgres-backed cosine similarity, top-4 chunks per turn

---

## Architecture diagram

```
Browser
   │
   │  POST /api/process/:fileId
   ▼
Vercel Edge (returns 202 + jobId in <1s)
   │
   │  inngest.send({ name: "process.file", data: {...} })
   ▼
Inngest Cloud
   │
   │  webhook → /api/inngest
   ▼
Vercel Function (process-file orchestrator)
   │
   ├── step.run("load-file")       → Postgres
   ├── step.run("extract-text")    → pdf-parse / mammoth
   ├── analyze branch:
   │     ├── short doc?
   │     │     └── single-pass per-provider chain
   │     └── medium+ doc?
   │           └── chain loop:
   │                 ├── step.run("analyze-gemini-2.5-flash")
   │                 │     OR
   │                 ├── Promise.all([
   │                 │     step.run("analyze-deepseek-v4-flash-pass1"),
   │                 │     step.run("analyze-deepseek-v4-flash-pass2")
   │                 │   ])  ← each in its own 60s Vercel function
   │                 ├── step.run("analyze-groq-llama-3.3-70b")
   │                 └── step.run("analyze-mistral-small")
   ├── step.run("persist-result")  → Postgres ProcessingResult
   └── step.run("cache-and-rag")   → PdfCache + buildRagIndex
```

Each `step.run()` is a separate Vercel function invocation with its own 60s budget. Inngest checkpoints between steps — failed steps don't kill prior progress.

---

## Local quick start

The active app is in `studysnap-next/`.

```bash
# 1. Postgres
docker compose up -d

# 2. Configure
cd studysnap-next
cp .env.example .env.local
#   set JWT_SECRET (any random string)
#   set DATABASE_URL (default works with docker-compose)
#   set at least one AI key (GOOGLE_API_KEY or DEEPSEEK_API_KEY recommended)

# 3. Install + migrate
npm install
npx prisma migrate dev --name init

# 4. Run
npm run dev                # → http://localhost:3000

# 5. (optional) Local Inngest dev server in another terminal
npx inngest-cli@latest dev # → http://localhost:8288 (Inngest dashboard)
```

Open localhost:3000, sign up, drop a PDF, watch it work.

---

## Get free AI keys

You only need ONE to start, but the cascade works best with multiple configured.

| Provider | Free tier | Get key |
|---|---|---|
| **Google AI Studio** (Gemini 2.5 Flash) — recommended | 250 RPD, 10 RPM | https://aistudio.google.com/app/apikey |
| **Groq** (Llama 3.3 70B) — fast LPU fallback | 12K TPM | https://console.groq.com/keys |
| **DeepSeek** (V4 Flash) — paid, $4 credit serves hundreds of packs | $4 trial credit | https://platform.deepseek.com/api_keys |
| **Mistral** (Small) | Free tier | https://console.mistral.ai/api-keys/ |

---

## Deploy

### Vercel (recommended)

1. Push to GitHub
2. Import on vercel.com → Framework: Next.js (auto-detected)
3. Set env vars (see `.env.example`) including `DATABASE_URL` pointing to Neon
4. Deploy

### Inngest (for the background queue)

1. Sign up at [inngest.com](https://www.inngest.com/) (GitHub login)
2. **Settings → Integrations → Vercel → Connect.** Auto-installs `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` on Vercel
3. **Critical:** in Inngest's Vercel integration page, set **Custom Production Domain** to your Vercel custom domain (`yourapp.vercel.app`). Preview URLs are blocked by Vercel SSO — Inngest will get 401 if pointed there
4. Trigger a fresh Vercel deploy — Inngest auto-discovers `process-file` at `/api/inngest`

### Database

Neon, Supabase, or any Postgres. Run `npx prisma migrate deploy` once after pointing `DATABASE_URL` at prod.

---

## Folder structure

```
studysnap-next/
├── app/
│   ├── api/
│   │   ├── auth/{signup,login,me}/
│   │   ├── upload/                       # in-memory PDF upload
│   │   ├── process/[fileId]/             # enqueues Inngest event, returns 202
│   │   ├── inngest/                      # Inngest webhook handler
│   │   ├── chat/                         # RAG chat endpoint
│   │   ├── history/, results/, dashboard/
│   │   └── stripe/{checkout,subscription-status,webhook}/
│   ├── (pages)/                          # Landing, Auth, Dashboard, Upload, Results, History, Billing
│   └── layout.tsx
├── components/                           # Navbar, Footer, Flashcard, fx/, ui/
├── lib/
│   ├── inngest.ts                        # Inngest client + processFile orchestrator
│   ├── ai/
│   │   ├── providers/                    # gemini.ts, openaiCompat.ts
│   │   ├── registry.ts                   # provider chain + per-provider config
│   │   ├── runWithFallback.ts            # legacy chain runner (chat path) + runOneProvider helper
│   │   ├── twoPass.ts                    # dead-path; merge logic ported into lib/inngest.ts
│   │   ├── chunked.ts                    # >120K char path
│   │   ├── ragIndex.ts, retrieval.ts, embeddings.ts
│   │   └── schema.ts, truncate.ts, telemetry.ts
│   ├── client/                           # browser-side api + zustand auth store
│   └── env.ts, prisma.ts, pdf.ts, prompts.ts, ...
└── prisma/schema.prisma
```

---

## Environment variables

See [studysnap-next/.env.example](studysnap-next/.env.example) for the full template.

```env
# Required
DATABASE_URL=postgresql://...
JWT_SECRET=change-me

# At least one AI key
GOOGLE_API_KEY=
DEEPSEEK_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=

# Inngest (auto-set by Vercel integration in prod)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Billing
BILLING_MODE=mock   # mock = $0 dev. live = real Stripe

# Limits
FREE_DAILY_UPLOAD_LIMIT=5
MAX_UPLOAD_MB=15
```

---

## What this repo also contains

The `frontend/` and `backend/` folders are the **legacy Express + Vite version**. They're kept for reference but the Next.js app in `studysnap-next/` is what's deployed and maintained.

---

## License

MIT
