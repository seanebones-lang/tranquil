# A Tranquil Space

A calm, scripture-grounded journaling app: magic-link auth, notes with voice capture hooks, Islamic research (Quran / Hadith / Tafsir via Grok Collections), a floating Grok agent with tools, heirloom sharing, accessibility-focused settings, and background jobs (STT, queues, scheduled digests and reflections).

**License:** [MIT](./LICENSE) · **Node:** ≥ 20 · **Docs:** [`docs/BUILD_PLAN.md`](./docs/BUILD_PLAN.md) (architecture & phased plan), [`docs/README.md`](./docs/README.md) (doc index), [`seeds/README.md`](./seeds/README.md) (Phase 0 corpus upload).

---

## Table of contents

- [Features](#features)
- [Stack](#stack)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Phase 0 — Grok Collections](#phase-0--grok-collections)
- [Background worker](#background-worker)
- [Scheduled jobs (Vercel Cron)](#scheduled-jobs-vercel-cron)
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
| **Auth** | Email magic links via Auth.js v5 + Resend (no passwords). |
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
| Auth | Auth.js v5 (`next-auth` **5.0.0-beta.31**), JWT sessions, Prisma adapter |
| Database | PostgreSQL + Prisma 6 |
| Cache / queues | Redis + BullMQ (`ioredis`) |
| Object storage | Cloudflare R2 (S3 API, `@aws-sdk/*`) |
| AI | Vercel AI SDK (`ai`, `@ai-sdk/xai`, `@ai-sdk/react`), Grok Collections REST helpers |

---

## Repository layout

```
├── auth.ts / auth.config.ts   # Auth.js (Node) vs Edge-safe middleware config
├── middleware.ts              # NextAuth middleware + matcher
├── prisma/schema.prisma       # Canonical schema (users, notes, chat, heirloom, audit, …)
├── vercel.json                # Cron schedules → /api/cron/*
├── worker/                    # BullMQ worker entrypoint + jobs
├── seeds/                     # Python scripts — upload Quran/Hadith/Tafsir to Collections
├── docs/                      # Build plan, bundle notes, doc index
└── src/
    ├── app/                   # App Router pages + API routes
    │   ├── api/
    │   │   ├── auth/[...nextauth]/
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
# Edit .env — minimum: AUTH_SECRET, NEXTAUTH_URL, DATABASE_URL, AUTH_RESEND_KEY, EMAIL_FROM

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

## Scheduled jobs (Vercel Cron)

[`vercel.json`](./vercel.json) defines HTTP cron targets:

| Path | Purpose |
|------|---------|
| `/api/cron/dormancy` | Heirloom / dormancy logic |
| `/api/cron/reflection` | Generates per-user daily reflections |
| `/api/cron/digest` | Weekly email digest |

Each handler expects **`Authorization: Bearer <CRON_SECRET>`** (see `src/lib/cron-auth.ts`). Set `CRON_SECRET` in Vercel (and locally when testing crons).

---

## Environment variables

Copy **[`.env.example`](./.env.example)** to `.env`. Summary:

| Variable | Required for | Notes |
|----------|----------------|-------|
| `AUTH_SECRET` | Auth | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Auth | Public URL, no trailing slash |
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

- **`auth.ts`** (root): full Auth.js config with Prisma + providers — import as **`~/auth`**.
- **`auth.config.ts`**: Edge-safe fragment consumed by **`middleware.ts`**.
- **`middleware.ts`** matcher skips static assets and **`/api/auth/*`** only.

**Important:** Several flows must reach the server **without** a logged-in session:

- **`/heirloom-access`** — heirs redeeming magic links  
- **`/api/cron/*`** — Vercel Cron (validated via `CRON_SECRET`)  
- **`/api/export?heirloomToken=...`** — heirloom markdown export  

Ensure `callbacks.authorized` in **`auth.config.ts`** returns `true` for those paths before enforcing `isLoggedIn`. Example pattern:

```ts
// Inside callbacks.authorized — illustrative; keep sign-in redirect logic intact.
const path = nextUrl.pathname;

if (path.startsWith("/heirloom-access")) return true;
if (path.startsWith("/api/cron")) return true;
if (path.startsWith("/api/export") && nextUrl.searchParams.has("heirloomToken"))
  return true;

// …then existing /signin handling and `return isLoggedIn` for everything else.
```

---

## Deployment

### Database (e.g. Railway)

1. Create PostgreSQL → copy `DATABASE_URL` into Vercel (and worker host).
2. Run migrations (`npm run db:migrate`) or push schema per your policy.

### Application (e.g. Vercel)

1. Import repo → set **all** env vars from `.env.example`.
2. Build runs `prisma generate` via `postinstall` / `build` script.
3. Configure **`CRON_SECRET`** and verify cron jobs invoke `/api/cron/*` with the Bearer header.

### Worker + Redis

Deploy **`npm run worker`** as a separate process with the same `DATABASE_URL`, `REDIS_URL`, R2, and xAI variables required by jobs.

### Resend

Production domains must be **verified** in Resend; update `EMAIL_FROM` accordingly.

---

## Design system

Tokens live in **`src/app/globals.css`** under `@theme` (paper/surface/sage/dusk/citation palette, serif + UI fonts). Root **`layout.tsx`** applies user preferences (`data-font-scale`, `data-contrast`, `data-reduced-motion`) when loaded from settings.

Utility **`cn`** and small helpers live in **`src/lib/utils.ts`**.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Redirect loop or 401 on cron | `CRON_SECRET` matches `Authorization` header; middleware allows `/api/cron/*`. |
| Heirloom page / export 403 or blocked | Middleware allows `/heirloom-access` and `/api/export?heirloomToken=…`; grant not revoked/expired. |
| Research / agent scripture errors | Phase 0 complete; `QURAN_*` / `HADITH_*` / `TAFSIR_*` IDs + `XAI_API_KEY` set. |
| Worker idle | `REDIS_URL` reachable from worker host; jobs actually enqueued. |
| Build fails on Prisma | `DATABASE_URL` not needed for `prisma generate`; ensure `postinstall` runs in CI. |

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
