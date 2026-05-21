# A Tranquil Space

A calm, scripture-grounded journaling app: magic-link auth, notes with voice capture hooks, Islamic research (Quran / Hadith / Tafsir via Grok Collections), a floating Grok agent with tools, heirloom sharing, accessibility-focused settings, and background jobs (STT, queues, scheduled digests and reflections).

**License:** [MIT](./LICENSE) · **Node:** ≥ 20 · **Docs:** [`docs/BUILD_PLAN.md`](./docs/BUILD_PLAN.md) (architecture & phased plan), [`docs/README.md`](./docs/README.md) (doc index), [`docs/TODO_100_OF_100.md`](./docs/TODO_100_OF_100.md) (shipping checklist), [`seeds/README.md`](./seeds/README.md) (Phase 0 corpus upload).

Use Railway’s **`*.up.railway.app`** URL for deploy/test until you attach a custom domain.

---

## Table of contents

- [Features](#features)
- [Stack](#stack)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Phase 0 — Grok Collections](#phase-0--grok-collections)
- [Background worker](#background-worker)
- [Scheduled jobs (Railway cron)](#scheduled-jobs-railway-cron)
- [Environment variables](#environment-variables)
- [npm scripts](#npm-scripts)
- [Authentication & middleware](#authentication--middleware)
- [Deployment](#deployment)
- [Design system](#design-system)
- [Troubleshooting](#troubleshooting)

---

## Features

| Area | What’s in the repo |
|------|---------------------|
| **Auth** | Clerk (email/password + OAuth per Clerk dashboard); **`~/auth`** syncs Clerk users into Prisma. |
| **Today** | Greeting, recent notes, daily reflection (DB-backed when cron has run), push-to-talk capture, chat FAB. |
| **Notes** | List, create, edit with autosave-oriented actions, related-notes panel, slash-command helpers, heirloom visibility toggle in chrome. |
| **Research & Library** | RAG-backed research flows and library browsing (requires seeded Collections + `XAI_API_KEY`). |
| **Chat** | Streaming `/api/chat` with Grok + tools; thread persistence via `/api/threads`. |
| **Settings** | Font scale, contrast, reduced motion, ambient sound preference, heirloom contact / unlock delay, grant management. |
| **Heirloom** | Heir unlock UI (`/heirloom-access`), markdown export (`/api/export`, optional `heirloomToken`), dormancy cron. |
| **Email** | Weekly digest cron + Resend (`src/lib/email.ts`). |
| **Audio** | `/api/recitation` redirects to CDN MP3s for verse refs (see route comments for self-hosting). |
| **Jobs** | BullMQ + Redis worker under `worker/` for pipelines that shouldn’t block requests. |

Export today is **Markdown** (`text/markdown`); PDF is left as a follow-on (see comments in `src/app/api/export/route.ts`).

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, RSC), Turbopack in dev |
| Language | TypeScript (strict) |
| UI | Tailwind 4 (`@theme` tokens), minimal hand-rolled UI primitives |
| Auth | Clerk (`@clerk/nextjs`); Prisma `User.clerkUserId` links accounts |
| Database | PostgreSQL + Prisma 6 |
| Cache / queues | Redis + BullMQ (`ioredis`) |
| Object storage | Cloudflare R2 (S3 API, `@aws-sdk/*`) |
| AI | Vercel AI SDK (`ai`, `@ai-sdk/xai`, `@ai-sdk/react`), Grok Collections REST helpers |

---

## Repository layout

```
├── auth.ts                    # Clerk → Prisma user bridge (import as ~/auth)
├── prisma/schema.prisma       # Canonical schema (users, notes, chat, heirloom, audit, …)
├── vercel.json                # Reference cron paths/schedules (trigger via Railway Cron or similar)
├── worker/                    # BullMQ worker entrypoint + jobs
├── seeds/                     # Python scripts — upload Quran/Hadith/Tafsir to Collections
├── docs/                      # Build plan, bundle notes, doc index
└── src/
    ├── middleware.ts          # Clerk middleware (must live under src/ with this layout)
    ├── app/                   # App Router pages + API routes
    │   ├── api/
    │   │   ├── chat/
    │   │   ├── threads/ ...
    │   │   ├── export/
    │   │   ├── recitation/
    │   │   └── cron/{dormancy,reflection,digest}/
    │   ├── (auth)/signin/
    │   ├── notes/
    │   ├── research/ , library/
    │   ├── settings/
    │   └── heirloom-access/
    ├── components/            # Nav, editors, chat FAB, khalwa, settings form, …
    ├── lib/                   # db, queue, r2, xai, islamic, agent-tools, email, cron-auth, …
    └── app/actions/          # Server actions (notes, voice, research, settings, …)
```

---

## Quick start

```bash
git clone <your-fork-or-remote> tranquil
cd tranquil

npm install          # or pnpm / yarn — triggers prisma generate (postinstall)

cp .env.example .env
# Edit .env — minimum: Clerk keys, NEXTAUTH_URL, DATABASE_URL (see `.env.example`)

npm run db:push      # or: npm run db:migrate — applies Prisma schema to Postgres

npm run dev          # http://localhost:3000 — redirects to /signin until authenticated
```

**Optional:** local Postgres via Docker:

```bash
docker run --name tranquil-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tranquil \
  -p 5432:5432 -d postgres:17
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tranquil
```

---

## Phase 0 — Grok Collections

Islamic lookup and agent tools expect **three Grok Collections** (Quran, Hadith, Tafsir) created by the Python seed scripts.

1. Follow **[`seeds/README.md`](./seeds/README.md)** (`--dry-run` first).
2. Copy the printed collection IDs into root `.env` as `QURAN_COLLECTION_ID`, `HADITH_COLLECTION_ID`, `TAFSIR_COLLECTION_ID`.
3. Ensure `XAI_API_KEY` is set for both the Next app and (where needed) `seeds/.env`.

Without Phase 0, research/agent scripture features will fail at runtime when those env vars are missing.

---

## Background worker

Processes queued jobs (STT, linking, etc.) using **Redis**:

```bash
# Requires REDIS_URL in .env
npm run worker:dev    # tsx watch
npm run worker        # single run (e.g. Railway service)
```

Run the worker alongside the Next.js server wherever you use uploads + queues.

---

## Scheduled jobs (Railway cron)

[`vercel.json`](./vercel.json) lists **recommended paths and UTC timings**. On **Railway**, trigger those URLs yourself — for example **Railway Cron**, a cron add-on, or any scheduler that **`GET`**s your app with **`Authorization: Bearer CRON_SECRET`**.

| Path | Purpose |
|------|---------|
| `/api/cron/dormancy` | Heirloom / dormancy logic |
| `/api/cron/reflection` | Generates per-user daily reflections |
| `/api/cron/digest` | Weekly email digest |

Each handler expects **`Authorization: Bearer <CRON_SECRET>`** (see `src/lib/cron-auth.ts`). Set **`CRON_SECRET`** in Railway for **web** (and reuse it wherever schedules those URLs).

---

## Environment variables

Copy **[`.env.example`](./.env.example)** to `.env`. Summary:

| Variable | Required for | Notes |
|----------|----------------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk | Server secret |
| `NEXTAUTH_URL` | App links | Same as public site URL (digest/cron fallbacks); no trailing slash |
| `DATABASE_URL` | App | Postgres connection string |
| `AUTH_RESEND_KEY` | Magic links + app email | Resend API key |
| `EMAIL_FROM` | Outbound mail | Dev: `onboarding@resend.dev`; prod: verified domain |
| `XAI_API_KEY` | AI / Collections | console.x.ai |
| `QURAN_COLLECTION_ID` etc. | Research / slash / agent | After Phase 0 seeds |
| `R2_*` | Audio / uploads | Cloudflare R2 |
| `REDIS_URL` | Worker / BullMQ | Railway or local Redis |
| `XAI_BASE_URL` | Optional | Override default API base |
| `CRON_SECRET` | Cron routes | Bearer token for `/api/cron/*` |

Seeds use a separate **[`seeds/.env.example`](./seeds/.env.example)** — keep upload keys scoped.

---

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next dev (Turbopack) |
| `npm run build` | `prisma generate && next build` |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run db:push` | Push schema (prototyping) |
| `npm run db:migrate` | Migrations (preferred for prod) |
| `npm run db:studio` | Prisma Studio |
| `npm run worker` / `worker:dev` | Background worker |

---

## Authentication & middleware

- **Clerk** handles sign-in and sign-up at **`/signin`** and **`/signup`** (also Clerk-hosted **`/sign-in`** / **`/sign-up`** paths are allowed).
- **`auth.ts`** (repo root, import **`~/auth`**): bridges Clerk **`currentUser()`** to Prisma **`User`** — creates users or links **`clerkUserId`** so **`session.user.id`** stays your DB primary key.
- **`src/middleware.ts`**: **`clerkMiddleware`** + **`auth.protect()`** for protected routes; static assets and Clerk internals are skipped via matcher.

**Important:** These flows must reach the server **without** a Clerk session (middleware allows them explicitly):

- **`/heirloom-access`** — heirs redeeming magic links  
- **`/api/cron/*`** — scheduled HTTP jobs (validated via `CRON_SECRET`)  
- **`/api/export?heirloomToken=...`** — heirloom markdown export  
- **`/api/recitation`** — public recitation endpoint  

When adding new public routes, update **`src/middleware.ts`** so they are not blocked by **`auth.protect()`**.

---

## Deployment

### Database (e.g. Railway)

1. Create PostgreSQL → copy `DATABASE_URL` into Railway (**web** + **worker** services).
2. Run migrations (`npm run db:migrate`) or push schema per your policy.

### Application (Railway - Production)

**Auto-deploy is now enabled** on every push to `main`.

- Railway project linked to `seanebones-lang/tranquil`
- `railway.json` configures Nixpacks build + separate `web` (Next.js) and `worker` (BullMQ) services
- `npm ci && npm run build` (with `postinstall: prisma generate`)
- Web starts with `npm start`, worker with `npm run worker`
- All env vars (`DATABASE_URL`, `REDIS_URL`, `XAI_API_KEY`, Clerk keys, `NEXTAUTH_URL`, `AUTH_RESEND_KEY`, `EMAIL_FROM`, `CRON_SECRET`, R2 credentials, etc.) must be set in Railway

Push to main = instant redeploy.

### Worker + Redis

Deploy **`npm run worker`** as a separate process with the same `DATABASE_URL`, `REDIS_URL`, R2, and xAI variables required by jobs.

### Resend

Production domains must be **verified** in Resend; update `EMAIL_FROM` accordingly.

### Public URL (Railway — test / default domain)

1. In Railway → **web** → **Networking → Generate domain** (or use the existing **`*.up.railway.app`** URL).
2. Set **`NEXTAUTH_URL`** on the **web** service to **`https://YOUR_APP.up.railway.app`** exactly — **no trailing slash** (used for digest links and other server-generated URLs).
3. In **Clerk** → **Domains**, add the same public host (Railway domain or custom) so redirect URLs stay valid.

Optional later: attach your own domain again; update **Clerk allowed origins** and **`NEXTAUTH_URL`** to that canonical HTTPS URL.

---

## Design system

Tokens live in **`src/app/globals.css`** under `@theme` (paper/surface/sage/dusk/citation palette, serif + UI fonts). Root **`layout.tsx`** applies user preferences (`data-font-scale`, `data-contrast`, `data-reduced-motion`) when loaded from settings.

Utility **`cn`** and small helpers live in **`src/lib/utils.ts`**.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| **404 after sign-in / sign-up** | Clerk Dashboard → **Paths**: set **Home / After sign-in URL** to **`/`** (or rely on app `forceRedirectUrl="/"`). OAuth flows may hit **`/sign-in/*`** — repo serves **`/sign-in/[[...sign-in]]`** as well as **`/signin`**. |
| Redirect loop or 401 on cron | `CRON_SECRET` matches `Authorization` header; middleware allows `/api/cron/*`. |
| Heirloom page / export 403 or blocked | Middleware allows `/heirloom-access` and `/api/export?heirloomToken=…`; grant not revoked/expired. |
| Research / agent scripture errors | Phase 0 complete; `QURAN_*` / `HADITH_*` / `TAFSIR_*` IDs + `XAI_API_KEY` set. |
| Worker idle | `REDIS_URL` reachable from worker host; jobs actually enqueued. |
| Mic greyed “isn’t detecting R2…” | Vars are read **at runtime** — restart **`npm run dev`** (or redeploy Railway) after setting **`R2_ACCOUNT_ID`**, **`R2_ACCESS_KEY_ID`**, **`R2_SECRET_ACCESS_KEY`**. No wrapping quotes unless the value itself contains spaces. Optionally **`CLOUDFLARE_ACCOUNT_ID`** instead of **`R2_ACCOUNT_ID`**. |
| **`WRONGPASS` / torrent of `[ioredis]` in Railway logs** | **`REDIS_URL`** on the **web** service does not match Railway Redis credentials (often after reset or typo). Paste the **`REDIS_URL`** from Railway’s Redis service variables into **web** → redeploy web + worker. |
| Clerk **Missing publishableKey** in logs | On Railway **web** set **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** plus **`CLERK_SECRET_KEY`**, redeploy. Edge middleware reads the **public** key at runtime. |
| Browser shows bare **Internal Server Error** | Next.js hides prod stack traces — read **Railway deploy logs** for the real error (often Redis or Clerk keys). |

---

## Documentation map

| Doc | Contents |
|-----|----------|
| [`docs/BUILD_PLAN.md`](./docs/BUILD_PLAN.md) | Full architecture, data model sketch, phased rollout, costing notes |
| [`docs/README.md`](./docs/README.md) | Index of bundle snapshots and pointers |
| [`seeds/README.md`](./seeds/README.md) | Corpus upload procedures |

---

## Contributing & security

Issues and PRs welcome for bugs and docs. Do **not** commit real `.env` files or API keys. Rotate any key that has appeared in a log or screenshot.

For production, review heirloom tokens, cron secrets, and R2 bucket policies as part of your threat model.

