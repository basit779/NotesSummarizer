# StudySnap AI

**Turn 10 hours of studying into 1 hour of high-efficiency learning.**

StudySnap AI is a full-stack SaaS that converts PDFs (lecture notes, textbook chapters, research papers) into exam-ready study material — summaries, key points, definitions, flashcards, and practice exam questions — powered by Anthropic Claude with structured tool-use output.

## Stack

- **Frontend:** Vite + React 18 + TypeScript + TailwindCSS + shadcn-style UI + Zustand + React Router
- **Backend:** Node.js + Express + TypeScript (MVC) + Prisma
- **Database:** PostgreSQL
- **AI:** Anthropic Claude (`claude-sonnet-4-5`) via `@anthropic-ai/sdk` tool-use for guaranteed JSON output
- **Auth:** JWT + bcrypt
- **Payments:** Stripe Checkout + Webhooks
- **File handling:** Multer with S3-ready storage abstraction

## Features

- Landing page with pricing
- Signup / Login with JWT
- Drag-and-drop PDF upload (15 MB max)
- AI-powered processing pipeline producing a 5-section study pack:
  - Summary (150–250 words)
  - Key Points
  - Definitions
  - Flashcards (flippable)
  - Exam questions (easy / medium / hard)
- Usage tracking (3 free uploads/day, unlimited for Pro)
- Stripe Checkout subscription ($9/mo Pro) with webhook-driven plan sync
- History view, per-result page with CSV flashcard export (Pro)
- Dark mode, responsive, modern SaaS UI

## Folder Structure

```
.
├── frontend/      # React + Vite + Tailwind
├── backend/       # Express + Prisma + TypeScript
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── server.ts
│   └── prisma/schema.prisma
├── docker-compose.yml    # local Postgres
└── README.md
```

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or use the bundled `docker-compose up -d`)
- An Anthropic API key (https://console.anthropic.com/)
- A Stripe test account + Stripe CLI (https://stripe.com/docs/stripe-cli)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/basit779/NotesSummarizer.git
cd NotesSummarizer

# Backend
cd backend
cp .env.example .env    # fill in values (see below)
npm install

# Frontend
cd ../frontend
cp .env.example .env
npm install
```

### 2. Start Postgres (if not already running)

```bash
cd ..
docker compose up -d
```

### 3. Run Prisma migrations

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run the app

In two terminals:

```bash
# Terminal 1 — backend (http://localhost:4000)
cd backend && npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend && npm run dev
```

Open http://localhost:5173.

## Environment variables

### `backend/.env`

```env
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/studysnap?schema=public

JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=7d

ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-sonnet-4-5

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_PRO=price_xxx
STRIPE_SUCCESS_URL=http://localhost:5173/billing?success=1
STRIPE_CANCEL_URL=http://localhost:5173/billing?canceled=1

FREE_DAILY_UPLOAD_LIMIT=3
MAX_UPLOAD_MB=15
```

### `frontend/.env`

```env
VITE_API_URL=http://localhost:4000
```

## Stripe setup

1. Create a recurring **Product** in Stripe Dashboard (test mode) → copy the `price_...` id into `STRIPE_PRICE_ID_PRO`.
2. Forward webhooks to your local backend:
   ```bash
   stripe listen --forward-to localhost:4000/api/stripe/webhook
   ```
   Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`.
3. Upgrade flow uses test card `4242 4242 4242 4242` (any future date, any CVC).

## API reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | – | Create account |
| POST | `/api/auth/login` | – | Login |
| GET  | `/api/auth/me` | ✅ | Current user |
| POST | `/api/upload` | ✅ | Upload a PDF (multipart `file`) |
| POST | `/api/process/:fileId` | ✅ | Run AI pipeline |
| GET  | `/api/history` | ✅ | Paginated past results |
| GET  | `/api/results/:id` | ✅ | Single result |
| GET  | `/api/dashboard` | ✅ | Usage + totals |
| POST | `/api/stripe/checkout` | ✅ | Start Stripe Checkout |
| POST | `/api/stripe/webhook` | – (raw) | Stripe event handler |
| GET  | `/api/stripe/subscription-status` | ✅ | Current plan info |

## AI pipeline

1. `pdfService.extractText` reads the PDF with `pdf-parse`.
2. Text is truncated to 60k chars.
3. `aiService.analyzeText` calls Anthropic Messages API with a tool named `emit_study_material` and `tool_choice` forcing its use — this guarantees valid structured JSON matching the expected schema.
4. Result is persisted in `ProcessingResult`.

Pro users get higher `max_tokens` and more items per section.

## Deployment

- **Backend:** Render / Railway / Fly.io. Set all env vars, `npm run build`, `npm start`. Run `npm run prisma:deploy` at release time.
- **Frontend:** Vercel / Netlify. Set `VITE_API_URL` to your backend URL.
- **DB:** Neon / Supabase / RDS.
- **Storage:** The `backend/uploads/` directory is local disk by default. To swap to S3, replace the `diskStorage` in `backend/src/middleware/multerUpload.ts` with `multer-s3` — the rest of the app only references `file.storagePath`.
- **Stripe webhook:** Point your live endpoint at `https://<your-api>/api/stripe/webhook` and update `STRIPE_WEBHOOK_SECRET`.

## Monetization

| | Free | Pro ($9/mo) |
|---|---|---|
| Uploads | 3 / day | Unlimited |
| Exam questions | 5–6 | 10–12 |
| Flashcards | 8–10 | 15–20 |
| CSV export | — | ✅ |
| Faster processing | — | ✅ |

## License

MIT
