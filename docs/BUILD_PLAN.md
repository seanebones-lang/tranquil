---
title: "A Tranquil Space — Build Plan"
description: "Full-stack specification, phased delivery, Phase 0 seeds, naming reconciliation — plus integrated repo snapshot (Next app, Prisma, Clerk, staged routes)."
---

# A Tranquil Space — Build Plan

This document captures the finalized architecture and week-by-week plan. Operational steps for uploading canonical Quran/Hadith/Tafsir into Grok Collections live in **[`seeds/README.md`](../seeds/README.md)** — run those scripts before the app relies on RAG lookups.

## Current repository snapshot (everything incorporated)

Phase 1 scaffold was **merged into this repo from `Downloads/files-2`** (flat files placed under `src/`, routed pages merged from nested `tranquil-space/` paths; **`mnt/`** tooling paths were discarded). **`npm install`** → **`npm run build`** validates the tree.

**Phase 2+ drop (`Downloads/files-3`):** BullMQ worker (**`worker/`** + **`src/lib/queue.ts`**), R2 presign/fetch (**`src/lib/r2.ts`**), xAI REST helpers (**`src/lib/{xai,stt,collections,user-collection}.ts`**), note CRUD actions (**`src/app/actions/{notes,voice}.ts`**), **`/notes`** listing, **`/notes/new`**, **`/notes/[id]`** with **`NoteEditor`**. Slash commands (**`/verse`**, **`/tafsir`**, **`/hadith`**) now call **`src/lib/islamic.ts`** (requires seeded Collections env vars). The long README that came with the zip is saved as **[`phase5-files-3-bundle.md`](./phase5-files-3-bundle.md)** (heirloom/cron/export APIs it mentions are largely **outside** this partial bundle).

**Phase 4 drop (`Downloads/files-4`):** Research (`/research`), Library (`/library`), citation UI (`citation-cards`, `verse-modal`), **`src/lib/{islamic,research}.ts`** (Grok Collections RAG + citation-enforced Grok compose), **`src/app/actions/research.ts`** (ask, lookups, save citations), **`/api/recitation`** redirect to everyayah.com MP3s, slash commands wired to **`lookupVerse` / `searchHadith`**. Snapshot README: **[`phase4-files-4-bundle.md`](./phase4-files-4-bundle.md)**.



**Phase 5 (agent chat) drop (`Downloads/files-5`):** **`/api/chat`** (streaming Grok + tools + xAI live search via `providerOptions`), **`src/lib/agent-tools.ts`** (`search_my_notes`, scripture search, `app_help`), **`/api/threads`** + **`/api/threads/[id]`**, full **`ChatWidgetFab`** (`useChat` + `DefaultChatTransport`). Bundle README (overlaps other Phase 5 docs): **[`phase5-files-5-bundle.md`](./phase5-files-5-bundle.md)**.



### Layout reference

| Path | Purpose |
|------|---------|
| **[`package.json`](../package.json)** | Scripts: `dev`, `build`, `db:*`, **`worker`** / **`worker:dev`** (background queues). Includes **`bullmq`**, **`ioredis`**, **`@aws-sdk/client-s3`**, **`date-fns`**, **`@ai-sdk/react`**, **`ai`**, **`@ai-sdk/xai`**, **`@clerk/nextjs`**. |
| **`prisma/schema.prisma`** | **Canonical** datastore shape (`User` includes **`clerkUserId`** + notes, citations, related notes, chat, reflections, heirloom fields, audit log). Naming is Prisma/Postgres idiomatic (`snake_case` columns where mapped); mentally align with § **Data model** sketch below. |
| **`auth.ts`**, **`src/middleware.ts`** | Clerk session → Prisma **`User`** bridge (`~/auth`); **`src/middleware.ts`** uses **`clerkMiddleware`** + route guards / public-path exceptions. |
| **`src/app/layout.tsx`** + **`globals.css`** | Tranquil design tokens (**Tailwind 4 `@theme`**), typography variables, reduced-motion guards. Fonts: **Cormorant Garamond**, **Inter**, **Amiri** via **`next/font/google`** — swap toward **Cormorant Infant** + **Amiri Quran** when the typography milestone lands (§ Visual design). |
| **`src/app/page.tsx`** | **Today** — heartbeat `lastSeenAt`, greeting, **`PushToTalk`** (captures blob; Phase 2 → R2 + STT), reflection + recent placeholders, **`ChatWidgetFab`** sheet stub. |
| **`src/app/(auth)/signin/`**, **`signup/`** | Clerk **`SignIn`** / **`SignUp`** embeds (`routing="path"`); **`check-email`** redirects (legacy magic-link UX retired). |
| **`src/app/notes/page.tsx`** | Notes shell (“Phase 2” placeholder). |
| **`src/components/`** | `nav`, `push-to-talk`, `chat-widget-fab`; **`ui/`** has hand-rolled `card`/`button`/`input` (Tailwind) — **not** a full `shadcn` CLI catalogue yet (Week 1 → optional Week 2 hardening). |
| **`src/lib/db.ts`** | Singleton **Prisma** client for Server Components / server actions. |
| **[`README.md`](../README.md)** | Phase 1 “what runs today”, local Postgres snippet, troubleshooting — **pairs with this file**. |

### Environment files (two surfaces)

| File | Audience |
|------|----------|
| **[`.env.example`](../.env.example)** (repo root) | Next.js — Clerk keys, **`NEXTAUTH_URL`**, **`DATABASE_URL`**, **`AUTH_RESEND_KEY`** / **`EMAIL_FROM`** (digest), **xAI**, collection IDs (**after** Phase 0), **R2**, **Redis** placeholders. |
| **[`seeds/.env.example`](../seeds/.env.example)** | Python seed scripts — **`XAI_API_KEY`** + (**after** uploads) **`QURAN_COLLECTION_ID`** / **`HADITH_COLLECTION_ID`** / **`TAFSIR_COLLECTION_ID`** for **`verify.py`**. |

---

## Phase 0 — Shared Grok Collections (one-time)

- Scripts live under **`seeds/`**: `seed_quran.py`, `seed_hadith.py`, `seed_tafsir.py`, `verify.py`, with shared helpers in `shared.py`.
- Always **`--dry-run` first**, then real upload with optional `--workers` and **`--reset`** only when you intend to wipe/recreate (destructive).

**Authoritative README:** **[`seeds/README.md`](../seeds/README.md)**

### Naming reconciliation (collections & env)

Early planning drafts sometimes used informal names (e.g. `quran_canonical`, `hadith_sahih_sittah`). **The runnable seed scripts create these collection names:**

| Collection name (actual) |
|--------------------------|
| `tranquil-quran` |
| `tranquil-hadith` |
| `tranquil-tafsir` |

After seeding, save the printed IDs in your secrets / `.env` for the Next.js app and for `verify.py` (see **`[seeds/verify.py](../seeds/verify.py)`**): **`QURAN_COLLECTION_ID`**, **`HADITH_COLLECTION_ID`**, **`TAFSIR_COLLECTION_ID`**, plus **`XAI_API_KEY`**.

---

## Embeddings situation (minimal outside APIs)

**Locked in:** xAI ships **Grok Collections API** and **`grok-embedding-small`** — managed RAG with hybrid semantic + keyword search, built-in citations, **$2.50 / 1K queries**. The entire AI surface can stay on xAI: chat, embeddings, vector store, RAG, voice, search — **zero additional AI vendors** if desired.

### Quran/Hadith integrity (mandatory citations)

**Pattern:** preload canonical **Tanzil** Quran text (Arabic + four translations + **Ibn Kathir** tafsir) and **Sahih Sittah** hadith with gradings into Grok Collections once at setup. After upload, the app queries RAG against verified corpora — no hallucinated scripture.

### Recitation audio

**everyayah.com** exposes MP3 URLs per verse (CDN-style, not an API). Option A: bundle one reciter (~5 GB e.g. Alafasy) to **Cloudflare R2** for full independence; Option B: hotlink (adds runtime third-party dependence).

---

## System at a glance

### Stack (final)

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 (App Router, RSC) | Latest App Router patterns; server actions reduce API boilerplate |
| Language | TypeScript strict | Catches schema/citation bugs early |
| UI | Tailwind 4 + shadcn/ui (customized) | Fast iteration; tranquil palette |
| Auth | Clerk (`@clerk/nextjs`) + Prisma **`User.clerkUserId`** | Hosted auth; DB stays source of truth for app **`user.id`** |
| Database | Postgres 17 on Railway | Notes, citations, threads, audit |
| Object storage | Cloudflare R2 | Audio, PDF exports, recitation cache |
| Background jobs | BullMQ + Redis on Railway | STT, tagging, embeddings sync, linking, digest |
| AI provider | xAI only (`@ai-sdk/xai` via Vercel AI SDK) | Single provider |
| AI models | `grok-4.3` (chat/agent), `grok-4.1-fast` (tagging/titles), `grok-stt`, `grok-embedding-small` (Collections), `grok-tts` optional | Right model per job |
| Vector / RAG | Grok Collections (hybrid retrieval) | Managed; citations-native; no self-hosted pgvector |
| Recitation | R2-hosted Alafasy (seed from everyayah.com) | Independent after preload |
| Email | Resend | Digest (and other transactional mail as needed) |
| PDF | `@react-pdf/renderer` server-side | Arabic glyph support |
| Hosting | Railway (Next.js web + worker services, Postgres, Redis, R2 endpoint) | Primary deployment |

---

## Persistent memory — how it actually works

Stuffing **all** notes into a single huge context each turn is **not** the right pattern (expensive, slow, relevance drops).

**Better:** **per-user Grok Collection**. Every saved note is embedded into the user’s private Collection. Each question retrieves the top ~**15** relevant notes via hybrid search (~**$0.0025** per query tier from Collections pricing discourse) and passes those snippets + question to **`grok-4.3`**. Retrieval scales; **1M** context stays headroom. If one operation genuinely needs extreme context legroom, hot-swap a **long-context** tier for **that call only** when product policy allows.

---

## Data model (Postgres)

```sql
users (
  id uuid pk, email citext unique, name text, role text default 'owner',
  heirloom_contact_email citext, heirloom_unlock_after_days int default 365,
  font_scale numeric default 1.0, contrast text default 'standard',
  reduced_motion bool default false, ambient_sound text,
  created_at timestamptz, last_seen_at timestamptz
)
notes (
  id uuid pk, user_id uuid fk, title text, body_md text,
  collection_doc_id text,  -- id in user's Grok Collection
  ai_tags text[], ai_summary text, ai_topic text,
  source text check (source in ('text','voice','imported')),
  status text check (status in ('draft','saved','archived','published')),
  published_slug text unique, is_heirloom_visible bool default true,
  created_at timestamptz, updated_at timestamptz, deleted_at timestamptz
)
note_audio (
  id uuid pk, note_id uuid fk, r2_key text, duration_sec int,
  transcript_segments jsonb,  -- [{start, end, text}]
  language text default 'en'
)
note_citations (  -- inline Quran/Hadith embeds inside a note
  id uuid pk, note_id uuid fk, position int,
  kind text check (kind in ('quran','hadith','tafsir')),
  reference text,           -- '2:255' or 'bukhari:1:1:1'
  arabic text, translation text, translator text,
  grade text                -- 'sahih','hasan','daif' for hadith only
)
related_notes (
  note_id uuid fk, related_note_id uuid fk, similarity numeric,
  primary key (note_id, related_note_id)
)
chat_threads (
  id uuid pk, user_id uuid fk, title text, created_at timestamptz
)
chat_messages (
  id uuid pk, thread_id uuid fk, role text, content text,
  tool_calls jsonb, citations jsonb, created_at timestamptz
)
daily_reflections (
  id uuid pk, user_id uuid fk, date date, prompt text,
  response_note_id uuid fk null, unique (user_id, date)
)
audit_log (
  id uuid pk, user_id uuid fk, action text, target_id uuid,
  at timestamptz, meta jsonb
)
```

---

## AI pipelines

### 1. Voice note ingest

Push-to-talk via `MediaRecorder` → upload **R2** → enqueue STT → worker calls **`grok-stt`** batch (e.g. `formatting=true`, `timestamps=true`, language as configured) → store transcript segments → enqueue pipeline **2**.

### 2. Auto-organize (on every save)

Single **`grok-4.1-fast`** structured output:

```txt
Return JSON: {
  title: string (≤8 words, only if user didn't provide one),
  summary: string (1 sentence),
  topic: string (one of his existing topics or new),
  tags: string[] (3-7, lowercased, kebab-case),
  related_intent: string (what the note is *about* in one phrase)
}
```

Then: upload/update note text in the **user Collection** (`collection_doc_id`), run similarity on `related_intent`, persist top **5** edges with similarity **`> 0.72`** in `related_notes`. Target sub-second UX; fractional cent per note at scale discipline.

### 3. Quran / Hadith / Tafsir lookup (integrity)

Never answer scripture from latent memory alone:

1. User asks / embeds scripture context.
2. Server runs **`grok-4.3`** with **forced tool** **`quran_search`** and/or **`hadith_search`** (and tafsir as needed).
3. Collections returns **verbatim** snippets + refs.
4. Model fills **validated** schema:

```ts
{
  answer: string,
  citations: Array<{
    kind: 'quran'|'hadith'|'tafsir',
    reference: string,
    arabic?: string,
    translation: string,
    translator: string,
    grade?: 'sahih'|'hasan'|'daif',  // hadith only, required where applicable
    collection_doc_id: string  // must match retrieval payload
  }>
}
```

5. Server rejects rows missing provenance from **actual** tool payloads; retry with tighter instructions if necessary.

Default translations surfaced in-product: **Sahih International**, **Pickthall**, **Yusuf Ali**, **Muhammad Asad** (e.g. side-by-side hover). **Ibn Kathir** (English abridged) for expand/tafsir.

### 4. Floating “Ask the App” agent

**`grok-4.3`** with tools such as:

- `search_my_notes` → personal Collection
- `quran_search` / `hadith_search` / `tafsir_search` → shared Collections
- optional `web_search` via xAI (paid per doc / per pricing page at ship time — budget explicitly)
- `app_help` static corpus (~30 entries)

Tone: cite always; link user notes when citing them; concise; refuse fabricated scripture.

### 5. Heirloom flag

Per user: heirloom contact email + dormancy threshold (default **365** days daily `last_seen_at` cron). Crossing threshold triggers one-time magic link (**read-only** notes with `is_heirloom_visible`). Optional manual immediate release UX.

---

## Visual design system (tranquil)

**Palette**

- Page `#FAF7F2` • Surface `#F2EDE4` • Primary `#7C9885` • Accent `#5B7B9A` • Citation `#B8956A` • Text `#2C2825` • Muted `#6B665F`
- Dark: bg `#1A1F26`, text `#E8E1D5`

**Type**

- Body/notes **Cormorant Garamond** • UI **Inter** • Arabic **Amiri Quran** • Display titles **Cormorant Infant**

**Motion & chrome**

Corners **12–16px**, single soft shadow, **line-height ~1.7** for prose, animations **cross-fade 300ms ease-out**, optional paper grain (**~4%** opacity SVG).

**Khalwa mode**

Single note fullscreen; ambient audio optional; serif-forward reading.

---

## Screens

1. **Sign in** — email + “Send my link”.
2. **Today** — big push-to-talk, reflection card, recent notes, pinned chat affordance.
3. **Notes** — **Timeline** (default), **Topics**, **Search**; cards show teaser, chips, mic icon when audio.
4. **Note editor** — `/verse 2:255` inserts citation block; related notes side panel; overflow → PDF, archive, publish, heirloom.
5. **Research** — scoped Quran/Hadith search → modal translations + tafsir + playback + attach to note.
6. **Library** — saved citations with filters.
7. **Chat** — floating **`◐`** widget + full page variant; citations as pills/links.
8. **Settings** — a11y, heirloom, export, sign out.

**Widget UX:** **`◐`** bottom-right opens **~70vh** sheet cross-route.

---

## Phased rollout

### Week 1 — Foundation

Repo + Next.js **16** + TS strict + Tailwind **4** scaffold (**landed — see § Current repository snapshot**). **Clerk** sign-in/up + **`~/auth`** Prisma bridge; **Resend** for digest mail. Prisma schema + **`db:push` / migrations** toward Railway Postgres. Tranquil tokens in **`globals.css`**. **Today** + **Notes** + **Chat FAB** shells. **Outstanding:** DNS + production deploy (**Railway**), optional full **shadcn** install, stakeholder device smoke tests, **commit → push**.

### Week 2 — Notes core

CRUD autosave (**~800ms** idle debounce). Push-to-talk + R2 upload + **`grok-stt`** worker. Timeline/topics/search (Postgres FTS first). Mobile PWA shell.

### Week 3 — AI organization

Provision Collections (shared scripture + **per-user notes** embedding). Seeds per **[`seeds/README.md`](../seeds/README.md)**. Pipeline **2** (`4.1-fast` + linkage). Related panel in editor.

### Week 4 — Islamic research

Research screen tool wiring (`quran_search` / etc.). Structured citation validation. Verse modal w/ translations + Ibn Kathir + audio. Slash embeds + citation library UX.

### Week 5 — Agent + polish

Floating agent + heirloom cron + digest email + PDF bulk export + Khalwa polish + reflections + accessibility.

### Week 6 — Soak

Optional prayer widget (**AlAdhan**, keyless — product call). Published notes + slug. Recitation cache to **R2** from **everyayah**. Performance & Lighthouse (**95+ mobile** aspirational).

---

## Cost heuristic (heavy single-active user illustrative)

Assume ~**30min** voice/day, ~**30** chat/day, ~**60** lookups/day scripture — numbers below are **order-of-magnitude**; reconcile with pricing pages monthly.

| Line item | Sketch |
|-----------|--------|
| STT batch hours | proportional to recording |
| Cheap tagging model | fractional / note |
| **4.3** conversational + scripture agents | dominates if volume high |
| Collections queries | billed per retrieval doc when searching |
| Web search tier | additive if enabled |
| Infra (**Railway**/Redis/postgres,R2**) | pooled across users |

For light usage expect **fractions–low tens**/mo illustrative; spike if agent + lookups run hot without caps.

Optional: xAI promo / bundled credits schemes change early burn — revisit at deploy.

---

## Week 1 — checklist (merged with codebase)

Legend: ✅ done in repo 🔲 still to do ⏭ usually later week

| Step | Detail |
|------|--------|
| ✅ | Repo + Next 16 App Router + TS strict + Turbopack `dev`; Tailwind **4** |
| ✅ | **`prisma/schema.prisma`** (full forward-looking model) |
| ✅ | Clerk (`@clerk/nextjs`) + **`~/auth`** Prisma bridge + **`src/app`** **`/signin`** / **`/signup`** |
| ✅ | Middleware (**`clerkMiddleware`**) + public-route exceptions (cron, heirloom, recitation) |
| ✅ | Tranquil **design tokens** in **`globals.css`**; **Today** / **Notes** / chat FAB stubs |
| ✅ | **`PushToTalk`** client capture (**Phase 2** wires R2 + STT) |
| ✅ | Python **Collections** toolchain under **`seeds/`** (coordinates with **§ Phase 0** below) |
| 🔲 | Optional: register custom domain → DNS → Railway web service (otherwise use **`*.up.railway.app`**) |
| 🔲 | **Railway** Postgres (**`DATABASE_URL`**) run **`npm run db:push`** or **`db:migrate`** |
| 🔲 | Clerk keys + Clerk **Domains** + **`NEXTAUTH_URL`** verified end-to-end sign-in; **`prisma db push`** ( **`clerkUserId`** column ) on prod DB |
| 🔲 | **Railway** env parity; redeploy smoke |
| ⏭ | **Railway Redis** / worker service (Week **2**) |
| ⏭ | **R2** bucket + keys (Week **2**) |
| ⏭ | **xAI** key + **`seeds/`** dry-run → full upload (Phase **0** / Week **3** cadence typical) |
| ⏭ | Optional **full shadcn** component sweep vs hand-rolled **`ui/`** primitives |
| 🔲 | Two-device login smoke (phone + stakeholder) |
| 🔲 | **Commit + push** (staged snapshot should include **`docs/`**, **`seeds/`**, **`src/`**, **`prisma/`**) |

Phase 1 closeout: reconcile errors → **merge PR / push main** → tag milestone if desired.

---

## Repository map

| Path | Purpose |
|------|---------|
| `docs/BUILD_PLAN.md` | This master plan (**architecture + integrated repo snapshot**) |
| `docs/README.md` | Short doc index |
| `README.md` | Phase 1 runbook (**local dev**, env table, Postgres docker tip) |
| `seeds/` | Phase **0** xAI Collections upload (**Python**) |
| `prisma/schema.prisma` | Authoritative Prisma models |
| `src/app/` | App Router routes + auth API |
| `src/components/` | UI building blocks (+ future shadcn growth) |

Still outstanding vs the master vision: e.g. **`react-hook-form`**, **`@react-pdf/renderer`**, dedicated Research/chat routes — track **`package.json`** + § phased rollout.


## Audit Note (2026-05-22)
Prisma schema was cleaned of legacy Auth.js v5 models. The data model now accurately reflects the Clerk-only auth system described throughout this document.

