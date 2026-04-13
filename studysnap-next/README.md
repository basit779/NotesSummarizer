# StudySnap AI — Next.js Edition

Single-project Next.js app — frontend + API routes — deploys to Vercel for **$0/mo**.

## Stack
- **Next.js 15** App Router (frontend + serverless API)
- **Tailwind + Framer Motion** (dark, cinematic UI)
- **Prisma + Postgres** (Neon free tier on prod, docker compose locally)
- **Multi-provider AI** with auto-fallback: Gemini 2.5 Pro / 2.0 Flash, Groq Llama 3.3 70B / 3.1 8B, OpenRouter DeepSeek V3, Mistral Small
- **JWT auth** + **mock Stripe** (real Stripe pluggable via `BILLING_MODE=live`)

## Local quick start

```bash
# 1. Postgres (from parent repo)
cd ..
docker compose up -d

# 2. Configure
cd studysnap-next
cp .env.example .env.local
# edit .env.local — at minimum set:
#   - JWT_SECRET (any random string)
#   - ONE AI key: GOOGLE_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY / MISTRAL_API_KEY

# 3. Install + migrate
npm install
npx prisma migrate dev --name init

# 4. Run
npm run dev
# → http://localhost:3000
```

## Deploy to Vercel (free)

1. Push this folder to a GitHub repo.
2. On vercel.com → Import Project → select repo.
3. Framework preset: Next.js (auto-detected).
4. Add env vars (same as `.env.local`) — make sure `DATABASE_URL` points to a hosted Postgres (Neon free).
5. Set `NEXT_PUBLIC_APP_URL` to your Vercel URL (e.g. `https://studysnap.vercel.app`).
6. Deploy. First deploy will run `prisma generate && next build`.
7. Run migrations on prod DB once: `npx prisma migrate deploy` (locally with prod `DATABASE_URL`, or via Vercel CLI).

## Project layout

```
studysnap-next/
├── app/
│   ├── api/                   # serverless API routes
│   │   ├── auth/{signup,login,me}/route.ts
│   │   ├── upload/route.ts            # in-memory PDF upload
│   │   ├── process/[fileId]/route.ts  # AI pipeline
│   │   ├── history/route.ts
│   │   ├── results/[id]/route.ts
│   │   ├── dashboard/route.ts
│   │   ├── stripe/{checkout,subscription-status,webhook}/route.ts
│   │   └── health/route.ts
│   ├── (pages)/               # Landing, Login, Signup, Dashboard, Upload, Results, History, Billing
│   ├── layout.tsx
│   └── globals.css
├── components/                # all UI (Navbar, Footer, Flashcard, ModelPicker, fx/, ui/)
├── lib/
│   ├── ai/                    # multi-provider AI registry + fallback
│   ├── client/                # browser-side api + auth store (zustand)
│   ├── env.ts, prisma.ts, billing.ts, stripe.ts, pdf.ts, usage.ts, prompts.ts, validators.ts
│   └── apiHelpers.ts          # requireAuth, withErrorHandling, signToken
└── prisma/schema.prisma
```

## Key differences from the Express version

- **No disk storage.** PDFs are uploaded into memory, base64-stored briefly in Postgres `storagePath`, processed, then cleared. Works on Vercel's read-only filesystem.
- **No Express middleware.** Each API route calls `requireAuth(req)` directly + wraps in `withErrorHandling`.
- **Same-origin API.** No CORS. Frontend uses `fetch('/api/...')` via [lib/client/api.ts](lib/client/api.ts).
- **Vercel limits:** Body size 4.5MB on Hobby plan (set 15MB locally). Function timeout 60s set via `export const maxDuration = 60`.

## Environment variables

See [.env.example](.env.example) for the full list with sources for each free AI provider.

Required minimum:
- `DATABASE_URL`
- `JWT_SECRET`
- One of: `GOOGLE_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `MISTRAL_API_KEY`

Defaults to `BILLING_MODE=mock` (no real payments).

## Verification

```bash
curl http://localhost:3000/api/health
# → {"ok":true,"service":"studysnap-api"}

# signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"a@b.com","password":"password123"}'
```

Then in the browser: signup → /upload → drop a small PDF → pick a model → see study pack.
