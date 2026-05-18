# A Tranquil Space — Phase 1

The foundation: Next.js 16 + TypeScript strict, Tailwind 4 with the tranquil
design system, Auth.js v5 magic-link via Resend, Prisma 6 schema covering the
full app (including Phase 2+ tables), and a working Today screen with the
push-to-talk button that captures audio. Deploy-ready to Vercel + Railway.

## What works on day one

- Sign-in via magic link (no password)
- Today screen with time-of-day greeting and your name
- Push-to-talk button: hold to record, release to stop. Captures audio via
  MediaRecorder, logs the blob to console (Phase 2 wires this to R2 + Grok STT)
- Hold the Space bar anywhere to record (keyboard accessibility)
- Reflection card and recent-notes section (placeholders for Phase 2 and 4)
- Floating chat widget button (opens a "coming soon" sheet)
- Sign out
- `lastSeenAt` stamped on every Today visit — drives heirloom dormancy detection later
- Dark mode honored automatically
- `prefers-reduced-motion` respected
- Full Prisma schema for every Phase including heirloom flag, related notes,
  citations, chat threads, daily reflections, audit log

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, RSC, Turbopack) |
| Language | TypeScript strict |
| Styling | Tailwind 4 (CSS-first `@theme` tokens) |
| Auth | Auth.js v5 (`next-auth`), Resend magic link |
| Database | Postgres + Prisma 6 |
| Fonts | Cormorant Garamond (body/display), Inter (UI), Amiri (Arabic) — all via `next/font/google` |
| Hosting | Vercel (app) + Railway (Postgres) |

## Setup

```bash
# 1. Install
pnpm install   # or npm install / yarn

# 2. Environment
cp .env.example .env
# Edit .env — see the "Environment" section below

# 3. Database
pnpm db:push   # creates tables in your Postgres
# or for proper migrations: pnpm db:migrate

# 4. Dev server
pnpm dev
```

Open http://localhost:3000 — you'll be redirected to `/signin`. Enter your
email, click "Send my link", check your inbox, click the link, land on Today.

## Environment

Required to run:

| Var | Notes |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` in dev |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_RESEND_KEY` | Resend API key from resend.com |
| `EMAIL_FROM` | Sender. Use `onboarding@resend.dev` for dev. For prod, verify your own domain in Resend. |

Already templated for Phase 2+ in `.env.example`:

- `XAI_API_KEY` — xAI key (https://console.x.ai)
- `QURAN_COLLECTION_ID` / `HADITH_COLLECTION_ID` / `TAFSIR_COLLECTION_ID` — from the seed scripts
- `R2_*` — Cloudflare R2 for audio storage
- `REDIS_URL` — for BullMQ workers

## Local Postgres (quick option)

```bash
docker run --name tranquil-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tranquil \
  -p 5432:5432 -d postgres:17
```

Then `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tranquil"`.

## Deploy

### Railway (database)

1. New project → Add Postgres
2. Copy the connection string into `DATABASE_URL` in Vercel (next step)
3. (Phase 2) Add Redis service to the same project

### Vercel (app)

1. `vercel link` or import the repo via the Vercel dashboard
2. Set env vars in Project Settings → Environment Variables
3. Add `prisma generate` is handled by `postinstall`; the build script also
   runs it
4. Deploy — `vercel --prod` or push to the connected branch

### Resend (magic-link email)

1. Sign up at https://resend.com
2. API Keys → Create. Paste into `AUTH_RESEND_KEY`
3. For dev: use `EMAIL_FROM=onboarding@resend.dev`
4. For prod: add your domain in Resend, verify DNS, then set
   `EMAIL_FROM=hello@yourdomain.com` (or whatever)

## File map

```
tranquil-space/
├── auth.config.ts            Edge-safe Auth.js config (used by middleware)
├── auth.ts                   Full Auth.js (Prisma adapter, Resend provider)
├── middleware.ts             Protects every route except /signin and /api/auth
├── next.config.ts
├── postcss.config.mjs        Tailwind 4 plugin
├── tsconfig.json             Strict, with @/* and ~/auth aliases
├── prisma/
│   └── schema.prisma         Full schema (Auth.js + app)
└── src/
    ├── app/
    │   ├── (auth)/signin/        Sign-in + check-email pages
    │   ├── api/auth/[...nextauth]/route.ts
    │   ├── notes/page.tsx        Placeholder, Phase 2
    │   ├── globals.css           Tailwind 4 import + @theme tokens
    │   ├── layout.tsx            Fonts + root html
    │   └── page.tsx              Today screen
    ├── components/
    │   ├── ui/                   Button, Card, Input
    │   ├── push-to-talk.tsx      MediaRecorder + breath pulse
    │   ├── nav.tsx               Top nav with sign-out
    │   └── chat-widget-fab.tsx   Floating chat button
    ├── lib/
    │   ├── db.ts                 Prisma singleton
    │   └── utils.ts              cn, greeting, firstName
    └── types/
        └── next-auth.d.ts        session.user.id typing
```

## Design tokens

Defined in `src/app/globals.css` under `@theme`. Available as
`var(--color-paper)`, `var(--font-display)`, etc., and as Tailwind utilities
(`bg-paper`, `text-ink`, `font-display` once Tailwind picks them up from
`@theme`).

Palette:

- `paper` `#FAF7F2` — page background, warm parchment
- `surface` `#F2EDE4` — card background, ivory
- `sage` `#7C9885` — primary, calm green
- `dusk` `#5B7B9A` — accent, links
- `citation` `#B8956A` — verse blocks, subtle gold
- `ink` `#2C2825` — text, warm charcoal (never pure black)
- `muted` `#6B665F` — secondary text

## Conventions worth noting

- `auth.ts` lives at the project root (Auth.js v5 convention); `~/auth` alias
  imports it cleanly
- Two config files — `auth.config.ts` is Edge-safe (no Prisma) and used by
  middleware; `auth.ts` has the full setup
- JWT sessions are used so middleware works on the Edge. `lastSeenAt` is
  stamped on Today page load (server component) and on sign-in event
- The push-to-talk component already captures real audio. In Phase 2 we'll
  replace the `console.info` call with a server action that uploads to R2 and
  enqueues a Grok STT job

## What's next

- **Phase 2** — note CRUD, auto-save, R2 upload + STT pipeline, AI tagging via
  Grok 4.1 Fast, per-user notes Collection, related-notes side panel, search
- **Phase 3** — Quran/Hadith/Tafsir lookup via the seeded Collections,
  citation-enforced answers, verse modal, slash command embed
- **Phase 4** — the "Ask the app" agent with the four tools
- **Phase 5** — heirloom flag wiring, PDF export, daily reflection, khalwa
  mode, weekly digest email, accessibility settings, polish

Ping when you've deployed and signed in once — Phase 2 next.
