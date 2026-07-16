# Study Snap — AI handoff context

> Last updated 2026-07-16. When you open Claude Code in this folder, point it at this file first so it has full context without re-discovering everything.

## 2026-07-16 session — DeepSeek 3-pass + chat budget cascade

- **DeepSeek medium+ docs now run a 3-pass PARALLEL split** (replaces the ultraMinimal 2-pass):
  - pass 1 = summary + keyPoints + definitions (`minimal` 0.7× counts)
  - pass 3 = flashcards only (16-20 cards)
  - pass 4 = examQuestions (8-10) + topicConnections + studyTips
  - Each pass targets ~1.5-1.8K output tokens, hard-capped at **2400** (registry.ts), 50s timeout → 19-36s typical per pass, all in parallel Inngest steps. Old 2-pass had to run ultraMinimal (0.5×) + 3500 cap and still grazed timeouts — the paid provider was producing the THINNEST packs. Now: ~1.8× more content AND bigger timeout margin.
  - Pass semantics are additive — pass 1/2 (legacy 2-way) still valid; passes 3/4 defined in prompts.ts (`buildUserPromptPass3/4`), schema.ts (`PASS3_SCHEMA/PASS4_SCHEMA`, `validatePass3/4`).
- **Chat fallback fixed** (lib/ai/chat.ts): the old `slice(0, 3)` attempt cap meant chat only ever tried the 3 Gemini variants — all on ONE API key — so exhausted Google quota = dead chat while paid DeepSeek sat unreachable. Now a **42s wall-clock budget** gates attempts instead; fast 429s let the cascade reach DeepSeek/Groq/Mistral. The 7s wait-retry only fires on the LAST configured provider.
- Free daily upload default 5 → **10** (matches landing/login/signup marketing). Billing page now shows the LIVE limit from /dashboard.
- History page redesigned to DESIGN_SYSTEM spec (dense rows, kind-badge pills, search, load-more, markdown-stripped previews). Billing redesigned (compound plan cards, glass-top gradient). Landing copy de-staled (no more "Gemini 2.0 Flash Engine").

## What this app is

Next.js app in [studysnap-next/](.) that takes uploaded notes (PDF/DOCX/text) and generates AI-powered study packs: summary, key points, definitions, flashcards, exam questions, plus optional RAG chat over the document.

## Current AI architecture (shipped 2026-05-03 evening — DO NOT redesign)

### Provider chain ([lib/ai/registry.ts](lib/ai/registry.ts))

```
1. gemini-2.5-flash    ← free primary, ~5-30s, serves ~80% of uploads
2. deepseek-v4-flash   ← paid backup ($4 credit), 2-pass parallel for medium+
3. groq-llama-3.3-70b  ← safety net (~15s LPU)
4. mistral-small       ← last resort
```

Same chain for default and XL tiers (deliberately unified).

### Async architecture (Inngest background queue)

**Vercel route** ([app/api/process/[fileId]/route.ts](app/api/process/[fileId]/route.ts)): `maxDuration = 10` (was 60). Returns 202 + jobId in <1s. Body just calls `await inngest.send({ name: 'process.file', data: { fileId, userId, plan, requestedModel } })`.

**Inngest function** ([lib/inngest.ts](lib/inngest.ts)): orchestrates the pipeline as separate `step.run()` calls. Per-user `concurrency: { key: 'event.data.userId', limit: 1 }` replaces the old in-process `runSerial` (deleted). `retries: 0` — failed pipelines mark file as ERROR, user re-uploads.

**Steps for a typical upload:**
- `load-file` (~5ms) — DB lookup
- `extract-text` (~50-500ms) — PDF/DOCX parse
- **Analyze step(s)** — see orchestration below
- `persist-result` (~500ms) — DB writes
- `cache-and-rag` (~5-15s) — PDF cache + RAG embeddings

### Per-provider step orchestration (the key infra win)

Each provider attempt runs as its own Inngest step = its own 60s Vercel function invocation. Per-provider client timeout: 55s (`PER_PROVIDER_TIMEOUT_MS` in lib/inngest.ts), giving 5s margin under Hobby's 60s wall.

**Analyze branch (in lib/inngest.ts):**
- Short tier (<5K chars): single-pass per-provider chain. Each provider tried in its own step.
- Medium / long / XL tier (5K-120K chars): chain loop. **When `provider === 'deepseek-v4-flash'`, runs 2-pass PARALLEL** via `Promise.all([step.run('analyze-deepseek-pass1'), step.run('analyze-deepseek-pass2')])`. Other providers always single-pass.
- >120K chars: legacy `analyze-chunked` step (chunked.ts already parallelizes 3 chunks).

**Why the 2-pass for DeepSeek specifically:**
DeepSeek physics = 50-80 tok/s on NVIDIA GPUs. Full pack output ~6K tokens = 75-120s = blows 60s wall. Splitting into pass1 (summary + keyPoints + definitions, ~3K tokens) + pass2 (flashcards + MCQs + tips + connections, ~3K tokens) means each parallel step only generates ~3K tokens = 37-60s = fits 55s timeout. Both passes get full DeepSeek quality. Merge logic in lib/inngest.ts ports from lib/ai/twoPass.ts.

**Why this isn't applied to other providers:**
- Gemini: ~100-200 tok/s, single-pass already fits in 55s
- Groq: ~200-400 tok/s LPU, finishes in ~15s
- Mistral: never reached in practice
- DeepSeek alone needs 2-pass on Hobby

### Proven behavior (2026-05-03 evening test)

Real Inngest run on a medium doc:
- `analyze-gemini-2.5-flash`: 55s (timed out — quota burned in dev)
- `analyze-deepseek-v4-flash-pass1`: 1m 11s (succeeded)
- `analyze-deepseek-v4-flash-pass2`: 35.274s (succeeded, ran in parallel)
- Merged → pack delivered via DeepSeek, tokensUsed: 11102
- Total wall: 2m 10s

## Inngest setup (already done, do not re-setup)

- Account at inngest.com (GitHub login)
- Vercel integration installed → auto-set `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` on Production/Preview/Development
- Custom production domain configured in Inngest dashboard: `studysnap-cyan.vercel.app` (bypasses Vercel deployment protection on preview-style URLs — preview URLs would get 401 from Vercel SSO before reaching `/api/inngest`)
- Webhook handler: [app/api/inngest/route.ts](app/api/inngest/route.ts) using `serve()` from `inngest/next`
- App synced as `studysnap` in Inngest dashboard, function `process-file` discoverable

## Files to know

| File | Role |
|---|---|
| [lib/inngest.ts](lib/inngest.ts) | Inngest client + processFile function (the orchestrator) |
| [app/api/inngest/route.ts](app/api/inngest/route.ts) | Webhook handler |
| [app/api/process/[fileId]/route.ts](app/api/process/[fileId]/route.ts) | Quick enqueue route (returns 202 + jobId) |
| [lib/ai/registry.ts](lib/ai/registry.ts) | Provider chain + per-provider config + timeoutMs threading |
| [lib/ai/runWithFallback.ts](lib/ai/runWithFallback.ts) | Has `runOneProvider` (used by Inngest orchestrator) + legacy `runWithFallback` (still used by chat path) |
| [lib/ai/providers/openaiCompat.ts](lib/ai/providers/openaiCompat.ts) | Generic OpenAI-compatible provider; accepts `timeoutMs`; default 25s for chat path, 55s for Inngest steps |
| [lib/ai/providers/gemini.ts](lib/ai/providers/gemini.ts) | Gemini provider; same `timeoutMs` pattern |
| [lib/ai/twoPass.ts](lib/ai/twoPass.ts) | Dead-path. Old XL-only runner. Merge logic was reused inline in lib/inngest.ts |
| [lib/prompts.ts](lib/prompts.ts) | TIER_COUNTS, buildUserPromptPass1, buildUserPromptPass2 — pass-aware logic intact from old XL system |
| [lib/ai/schema.ts](lib/ai/schema.ts) | PASS1_SCHEMA + PASS2_SCHEMA + validators, intact |

## What does NOT fix any problem (already tried + rejected)

- ❌ Cutting TIER_COUNTS — degrades output, user explicitly rejects
- ❌ Single-pass DeepSeek with extended timeout (>55s) — physics still wins, no headroom under 60s wall
- ❌ Re-introducing serial 2-pass — was tried, removed for blowing 60s budget. Current 2-pass is PARALLEL via Inngest steps which is fundamentally different
- ❌ Cutting schema — same problem, real value loss
- ❌ Paying for Gemini Pro alone — fixes quota wall but doesn't help DeepSeek physics

## Next-step options (not blocking, future)

| Option | Cost | What it gives |
|---|---|---|
| Vercel Pro | $20/mo | 300s function cap → DeepSeek single-pass works for any size, could simplify by removing 2-pass code |
| Railway / Render | ~$5-14/mo | No timeout but cold starts, Next.js less optimized |
| Stay on Hobby | $0 | Current architecture works |

Recommendation: stay on Hobby unless other limits become painful (bandwidth, build minutes, etc.).

## User context

- Technically sharp, very engaged, will push back when an answer feels wrong (which is good — that's how we got to 2-pass)
- Auto-commit + push preference (see project memory: `feedback_auto_commit_push.md`). Note: sandbox blocks `git push origin main` directly; user runs the push command themselves
- DeepSeek key in `process.env.DEEPSEEK_API_KEY`. Confirmed working via separate test chatbot directory on Desktop
- Cares about the $4 DeepSeek budget actually serving packs (not being wasted on aborts) — that was the whole point of the 2-pass refactor
- Cares about Gemini quality being preserved (Gemini-primary chain answers this)

## Codebase non-obvious notes

- DeepSeek thinking-mode disable uses `extraBody: { thinking: { type: 'disabled' }, chat_template_kwargs: { thinking: false } }` in [registry.ts](lib/ai/registry.ts). Verify in Vercel logs that `completionTok` stays reasonable (not 12K+) — if it spikes, thinking is leaking
- DeepSeek model ID is `deepseek-v4-flash`. Per official 2026-05 announcement, legacy `deepseek-chat` / `deepseek-reasoner` retire 2026-07-24 (currently route to V4 Flash anyway)
- Inngest v4.2.6 — `createFunction` signature: `(options, handler)` with `triggers` IN options. EventSchemas/`fromRecord` was removed in v4 — schemas via `eventType()` per-trigger now (we use loose typing + cast)
- Inngest `step.run()` calls inside `Promise.all([])` ARE dispatched in parallel (each as its own Vercel function invocation)
- `lib/ai/queue.ts` (old `runSerial`) was DELETED — replaced by Inngest concurrency keys

## Common debugging

- **Inngest run shows analyze step timeout:** check that custom production domain is set in Inngest dashboard (Integrations → Vercel → Configure). Preview URLs get 401 from Vercel SSO
- **DeepSeek `completionTok` > 8K:** thinking-mode leaking. Verify `extraBody.thinking` flags in registry.ts
- **All providers failing for medium+ doc:** could be Gemini RPD exhausted + DeepSeek 2-pass both failing. Check Inngest run trace per-step error messages
- **Cold-start 500 on /upload immediately after deploy:** Vercel lambda still warming up. Refresh after 5s

## Commit history this session (2026-05-03)

- `72c6972` — Inngest background queue (Option A)
- `6ce5c85` — Per-provider Inngest steps + DeepSeek-first chain (Option C)
- `ae17e64` — Gemini-primary chain + DeepSeek 2-pass parallel for medium+ docs
