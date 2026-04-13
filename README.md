# StudySnap AI

**The AI study operating system.** Drop a PDF — get summaries, flashcards, definitions, and exam questions in seconds. Built for students who move fast.

## Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind + Framer Motion (dark, cinematic UI)
- **Backend:** Node.js + Express + TypeScript + Prisma
- **Database:** PostgreSQL
- **AI:** Multi-provider — Gemini (2.5 Pro / 2.0 Flash), Groq (Llama 3.3 70B / 3.1 8B), OpenRouter (DeepSeek V3 free), Mistral Small. Automatic rate-limit fallback. Pick from the UI.
- **Auth:** JWT + bcrypt
- **Billing:** Mock by default ($0 mode). Real Stripe pluggable when you're ready.

## Quick start

```bash
# 1. Postgres
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # add at least one AI provider key
npm install
npx prisma migrate dev --name init
npm run dev                   # → http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # → http://localhost:5173
```

That's it. Open http://localhost:5173, sign up, drop a PDF.

## Get a free AI key (need at least ONE)

| Provider | Free tier | Get key |
|---|---|---|
| **Google AI Studio** (Gemini 2.5 Pro + 2.0 Flash) — recommended | Generous, daily reset | https://aistudio.google.com/app/apikey |
| **Groq** (Llama 3.3 70B + 3.1 8B Instant) | Fast, generous | https://console.groq.com/keys |
| **OpenRouter** (DeepSeek V3 free + many) | Free tier on `:free` models | https://openrouter.ai/keys |
| **Mistral** (Mistral Small) | Free tier | https://console.mistral.ai/api-keys/ |

Set any combination in `backend/.env`. The app automatically falls back if one is rate-limited.

## Folder structure

```
.
├── frontend/                    # Vite + React + Tailwind + Framer Motion
│   └── src/
│       ├── components/
│       │   ├── fx/              # GridBackground, PageTransition, Reveal
│       │   ├── ui/              # GlassCard, MotionButton, primitives
│       │   ├── ModelPicker.tsx  # AI model dropdown
│       │   └── ...
│       └── pages/               # Landing, Login, Signup, Dashboard, Upload, Results, History, Billing
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── ai/              # multi-provider registry + fallback runner
│   │   │   │   ├── providers/   # gemini, openaiCompat (Groq/OR/Mistral)
│   │   │   │   ├── registry.ts
│   │   │   │   ├── runWithFallback.ts
│   │   │   │   └── schema.ts
│   │   │   ├── billing/         # mock/live billing facade
│   │   │   ├── aiService.ts     # public AI facade (unchanged API)
│   │   │   └── ...
│   │   └── ...
│   └── prisma/schema.prisma
├── docker-compose.yml
└── README.md
```

## Environment

`backend/.env` (see `backend/.env.example` for full template):

```env
# Required
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/studysnap?schema=public
JWT_SECRET=change-me

# At least one AI key
GOOGLE_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
MISTRAL_API_KEY=

# Billing mode
BILLING_MODE=mock              # mock = $0 dev mode. live = real Stripe.

# Limits
FREE_DAILY_UPLOAD_LIMIT=3
MAX_UPLOAD_MB=15
```

## How the AI pipeline works

1. PDF uploaded → `uploadController` saves file + logs usage.
2. `processController` calls `extractTextFromPdf` → `analyzeText(text, plan, requestedModel?)`.
3. `analyzeText` → `runWithFallback` tries the requested model first, then walks the configured fallback chain on rate-limit / 5xx / bad-JSON errors.
4. Each provider returns a validated `StudyMaterial` JSON (summary, keyPoints, definitions, examQuestions, flashcards).
5. Result persisted to `ProcessingResult` table; response includes the `model` actually used and the `attempted` chain for debugging.

## API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | – | Create account |
| POST | `/api/auth/login` | – | Log in |
| GET  | `/api/auth/me` | ✓ | Current user |
| POST | `/api/upload` | ✓ | Upload PDF (multipart `file`) |
| POST | `/api/process/:fileId` | ✓ | Generate study pack — body: `{ model?: ModelId }` |
| GET  | `/api/history` | ✓ | Paginated past results |
| GET  | `/api/results/:id` | ✓ | Single result |
| GET  | `/api/dashboard` | ✓ | Usage + totals + recent |
| POST | `/api/stripe/checkout` | ✓ | Mock or real checkout |
| GET  | `/api/stripe/subscription-status` | ✓ | Current plan |
| POST | `/api/stripe/webhook` | – | Stripe events (live mode only) |
| GET  | `/api/health` | – | Health check |

## Switching to real Stripe (later)

1. Create a Stripe account + recurring product → copy the `price_…` id.
2. Fill `STRIPE_*` env vars in `backend/.env`.
3. Set `BILLING_MODE=live`.
4. Forward webhooks: `stripe listen --forward-to localhost:4000/api/stripe/webhook` → copy `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
5. Done — no code changes needed.

## Verification checklist

```bash
# 1. Postgres healthy
docker compose ps                 # studysnap-postgres-1   running   0.0.0.0:5432

# 2. Migrations applied
cd backend && npx prisma migrate status

# 3. Backend boots
npm run dev                       # logs "API on :4000"
curl http://localhost:4000/api/health
# → {"ok":true,"service":"studysnap-api"}

# 4. Frontend boots
cd ../frontend && npm run dev     # opens http://localhost:5173
```

End-to-end: sign up → drop a PDF → pick a model → see study pack → flip flashcards → click upgrade → mock-Pro flips your plan.

## Deploy

- **Backend:** Railway / Render / Fly.io. `npm run build && npm start`. Run `npx prisma migrate deploy` on release.
- **Frontend:** Vercel. Set `VITE_API_URL` to your backend URL (or proxy via `vercel.json`).
- **DB:** Neon / Supabase free tier.

## License

MIT
