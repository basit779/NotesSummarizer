# StudySnap Design System

Source of truth for visual language. Derived from 21st.dev component research, not invented.

## Tier split

- **Tier-1 (landing only):** radial halos, animated gradients, scroll-reveals, magnetic CTA. Source: `hero-with-mockup`.
- **Tier-2 (all in-app — dashboard, upload, result, history, billing, auth):** motion only on state changes. No ambient loops, no hover-scale on buttons.
- **Sanctioned exception:** flashcard aurora hover — one delight moment, in-app only on flashcards.

## Tokens

Already established in `tailwind.config.js` + `app/globals.css`. Reusing, not replacing.

- Canvas: `bg-ink-950` (#09090b)
- Elevated surfaces: `bg-white/[0.02]` → `bg-white/[0.04]`
- Hairline border: `border-white/[0.06]`
- Emphasis border: `border-white/[0.12]`
- Accent: `mint-500` (#10b981) — **once per viewport** in-app, multiple on landing
- Typography: Geist Sans (narrative) / JetBrains Mono (metadata, uppercase, 0.12-0.18em tracking)
- Radii: **4-6px** interactive (buttons, inputs) · **12px** cards · **9999px** pill (chat composer)

## Component DNA (each sourced)

| Pattern | Source | Applies to |
|---|---|---|
| Metric card w/ mint SVG arc flourish | `statistics-card-2` | Dashboard stats |
| Dense row w/ ItemMedia/Content/Actions slots + hairline divider + focus-visible ring | `item` / `itemgroup` | History, dashboard recent-packs, result sidebar |
| Compound `PricingCard.Header/Plan/Badge/Price/List` w/ glass-top gradient | `pricing-card` | Billing |
| Sticky header + ScrollArea message log + hover-reveal message actions | `messaging-conversation` | Result page chat sidebar |
| Auto-resize pill textarea w/ leading/trailing action pills, mint send-on-content | `prompt-input` | Chat composer |
| 3D flip at `perspective:2000px`, 700ms, `backface-visibility:hidden` | `flip-card` | Flashcards — + aurora sheen on group-hover (mint→cyan conic-gradient `::before`) |
| Option buttons w/ correct=mint / incorrect=rose border-resolve on submit, explanation collapse | `quiz-section` | Result page quiz tab |
| Motion dropzone w/ halo pulse on drag + spring file-row entry (softened) | `file-upload` (preetsuthar17) | Upload page |
| Radial brand-color Glow halo behind `animate-appear` gradient headline + product mockup | `hero-with-mockup` | Landing only |

## Motion grammar

- **In-app:** 150-220ms micro (hover, focus, bg shift) · 250-350ms drawer/modal · no loops, no hover-scale, no ambient.
- **Landing:** above + `animate-appear` staggered reveals + scroll-triggered blur-fades + radial halos.
- **Flashcard aurora:** conic-gradient sheen rotates via CSS custom property on hover, mint→cyan range only.

## Typography scale (locked)

| Role | Size | Tracking | Weight |
|---|---|---|---|
| Landing display | 56-72px | -0.03em | 600 |
| Page h1 | 34-44px | -0.025em | 600 |
| Section h2 | 22-26px | -0.015em | 600 |
| Body | 14.5px (lh 1.6) | normal | 400 |
| Inline label | 13.5px | normal | 500 |
| Meta (mono) | 11-12px | 0.12-0.18em uppercase | 400 |

No ad-hoc sizes. Arbitrary values only when a scale entry doesn't fit.

## Spacing scale

**4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96.** No other values.

## Layout grids per page

| Page | Container | Structure |
|---|---|---|
| Landing | full-bleed sections | content `max-w-6xl` |
| Dashboard | `max-w-6xl` | 4-up metric strip → 2-3col pack grid |
| Upload | `max-w-xl` | focused single-column |
| Result | `[220px \| 1fr \| 400px]` desktop | stack → drawer on mobile |
| History | `max-w-4xl` | dense list (narrower than dashboard — signals "archive" not "home") |
| Billing | `max-w-3xl` | two-col plan row |
| Auth | centered `max-w-sm` | card |
| 404/500 | centered minimal | — |

## Per-page signature element (anti-slop)

Each page has ONE element nothing else in the product has. Must pass the **5-meter test** — identifiable from blurry/distant view, not buried.

| Page | Signature element |
|---|---|
| Landing | Radial mint Glow halo behind hero mockup |
| Dashboard | Mint SVG arc bleeding off metric card right edge |
| Upload | Soft mint halo pulse behind drop icon during drag |
| Result | 3-col sticky workspace + aurora-hover flashcards |
| History | Kind-badge pills inline in each row (`NOTES` / `QUIZ` / `FLASHCARDS`) |
| Billing | Glass-top gradient fade on plan card header |
| Auth | Ultra-minimal, no decoration — the quiet of the system |
| 404/500 | Big mono error code + Lucide icon glyph |

## Anti-slop checks (6 — run before every commit)

1. Does this page have a **unique visual element** that's not on other pages?
2. Is there at least one **delightful micro-interaction**?
3. Does typography have **real hierarchy**, or are 3 text sizes doing all the work?
4. Is spacing **deliberate** (pulled from the scale, not random)?
5. Would a **real designer** look at this and think "someone put care into this" or "AI made this fast"?
6. **Screenshot test:** would I screenshot this page and send it to a friend? If not, iterate until yes.

Plus: signature element must pass the **5-meter test** (identifiable from blurry/distant view).

## Workflow (per page)

1. Read current component end-to-end
2. Report COMPONENT CONTRACT (state, props, handlers, API calls, preserve list)
3. Adapt sourced component, do not hand-roll
4. Run anti-slop 6-check; iterate if any fail
5. Typecheck (`npx tsc --noEmit`) — zero new errors
6. Commit: `feat(ui): redesign <page-name>`
7. Push to main
8. Wait for live-test approval before next page

## Execution order

1. Landing (`/`)
2. Sign in / Sign up (`/login`, `/signup`)
3. Dashboard (`/dashboard`)
4. Upload (`/upload`)
5. Result (`/results/[id]`)
6. History (`/history`)
7. Billing (`/billing`)
8. 404/500 (light touch-up only)
