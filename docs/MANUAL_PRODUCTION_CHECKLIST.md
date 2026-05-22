# Manual checklist: production (Railway) end-to-end

Use this like a punch list: do it in order, check boxes, don’t assume “it should infer” anything from the README alone.

---

## What “working as intended” means (pick your bar)

Minimal “journal + login”:

- [ ] Open HTTPS URL → sign in with Clerk → land on **`/`**.
- [ ] **`/notes/new`** opens and you can type, autosave sticks (Postgres wired).
- [ ] Nav works (Today, Notes, Settings).

Full product (everything the repo wires up):

- [ ] Above, plus **`/research`** returns grounded hits (Phase 0 collections + `XAI_API_KEY`).
- [ ] **`/api/chat`** works (same xAI stack; Redis used for chat rate limit but chat can degrade if Redis is wrong—fix Redis anyway).
- [ ] Voice: push-to-talk creates a note and transcript pipeline runs (**R2 + `REDIS_URL` + worker running**).
- [ ] Cron jobs can be invoked with **`CRON_SECRET`** (reflection/digest/etc. as you enable them).

---

## 0 — Accounts / dashboards you actually need

- [ ] **Railway**: project with billing/credits that can run **Postgres + Redis + two Node services**.
- [ ] **Clerk**: Application for Tranquil; you will copy **publishable + secret** keys.
- [ ] **xAI**: API key (`XAI_API_KEY`) with access to Models + Collections + STT APIs you intend to use.
- [ ] **Resend**: only if weekly digest mail matters in prod (optional at first).
- [ ] **Cloudflare R2**: only if voice notes matter in prod (optional at first).
- [ ] Optional: DNS / custom domain (skip until base URL works).

---

## 1 — Railway: Postgres

- [ ] Add **PostgreSQL** plugin/service to Railway.
- [ ] Copy **`DATABASE_URL`** from the Postgres service (**Variables** / **Connect**) — Railway usually injects **`${{ Postgres.DATABASE_URL }}`** if you wire references; paste or reference consistency is what matters.

You will reuse this **`DATABASE_URL`** on **both** `web` and `worker`.

### Apply Prisma schema to prod DB

The app expects tables including **`User.clerkUserId`**. Migration SQL lives in **`prisma/migrations/`** — see **`docs/PRISMA_MIGRATIONS.md`**.

**Railway internal URL:** Railway’s **`DATABASE_URL`** often uses **`postgres-….railway.internal`**. Your **Mac cannot open that hostname** (**`railway run npm run db:deploy` still fails** with **`P1001`**). Root **`railway.toml`** configures **Pre-deploy** **`npm run db:deploy`** so migrations run **on Railway** on each **`web`** deploy (after merge/push **`main`**).

**From your laptop (optional one-off):** use Postgres **Public** TCP **`postgresql://`** from the dashboard → `export DATABASE_URL='…'` → `npm run db:deploy` — or run against local Docker Postgres only for dev.

**New empty database (recommended):**

```bash
export DATABASE_URL='postgresql://...real URL..., not placeholders...'
npm run db:deploy
```

- [ ] Or rely on **`railway.toml` Pre-deploy** after you **git push** (no laptop needed).

**DB already populated with older `db push` only:** you may **`migrate resolve`** the baseline migration once — full steps in **`docs/PRISMA_MIGRATIONS.md`**.

**Prototype only:** `npx prisma db push` avoids migration history — not ideal for repeatable prod.

Don’t skip applying schema: missing columns → obscure runtime errors during auth/note writes.

---

## 2 — Railway: Redis

- [ ] Add **Redis** to Railway (or use a managed Redis with a **`redis://`** / **`rediss://`** URL).
- [ ] Copy the **exact `REDIS_URL`** from the Redis service.

Critical:

- [ ] Paste **`REDIS_URL` into BOTH services: `web` and `worker`**.
- [ ] Ensure there is **no typo**, no truncated password, and if Redis was **reset** / password rotated you **update every service** referencing that URL again.
- [ ] **`WRONGPASS`** in logs = wrong URL/password — fix at Redis source, redeploy **`web`** + **`worker`**.

Redis is required for BullMQ (**voice transcription queue**, organize/embed jobs, chat rate-limiting against Redis).

---

## 3 — Railway: Two Node services (`web`, `worker`)

Your repo **`railway.json`** describes **`web`** and **`worker`**:

| Service | Build | Start command | Role |
|--------|--------|---------------|------|
| `web` | `npm ci && npm run build` | `npm start` | Next.js app |
| `worker` | `npm ci` (no Next build needed) | `npm run worker` | BullMQ processors |

- [ ] Create/configure **`web`** to match **build → `npm ci && npm run build`**, **start → `npm start`**.
- [ ] Create/configure **`worker`** to match **`npm ci`**, **start → `npm run worker`**.
- [ ] Point both at **same repo / same branch** (`main`).
- [ ] Generate a public domain for **`web`** (Networking) — copy the **`https://…up.railway.app`** canonical URL **without trailing slash**.

**If opening that URL shows 404 / “not found”:**

- [ ] The domain is attached to the **`web`** service, not Redis/Postgres/`worker` (**`worker`** has no HTTP server).
- [ ] After a failed deploy, regenerate the domain or redeploy — Railway can front a dead route.
- [ ] This repo uses **`output: "standalone"`** and **`npm start` → `scripts/start-production.mjs`** so the app matches [Railway’s Next.js self-hosted guide](https://docs.railway.app/guides/nextjs). If you overrode **Start command**, use **`npm start`** (not a raw `next dev` / empty command).

---

## 4 — Clerk (non-negotiable for auth pages)

For service **`web`**, set exactly these variable names:

- [ ] **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** = publishable key (starts with **`pk_live_`** or **`pk_test_`**).
- [ ] **`CLERK_SECRET_KEY`** = secret key (starts with **`sk_live_`** or **`sk_test_`**).

Then in Clerk dashboard:

- [ ] **Domains / allowed origins** include your Railway hostname(s) (**`*.up.railway.app`** and custom domain later).
- [ ] Paths: **sign-in/up URLs** should align with **`/signin`**, **`/signup`** (repo also exposes **`/sign-in`**, **`/sign-up`** for OAuth quirks).
- [ ] Optionally set Clerk “Home / redirect after sign-in” to **`/`** (the app forces redirects too, but don’t fight the dashboard).

If logs say **`Missing publishableKey`** you missed **`NEXT_PUBLIC_…`** or didn’t redeploy after adding it.

---

## 5 — Public URL / link base

Still on **`web`**:

- [ ] **`NEXTAUTH_URL`** = your live site root, e.g. `https://web-production-xxxx.up.railway.app` — **no trailing slash**.
  - Repo still reads this label for cron/digest/link generation even though Clerk replaced NextAuth for login.

Redeploy after changing it.

---

## 6 — xAI (`XAI_API_KEY`)

On **`web` + `worker`** (anything that touches STT/embeddings/collections pipelines):

- [ ] **`XAI_API_KEY`** = real console key (**not** `your_xai_key_here`).
- [ ] (**Optional**) **`XAI_BASE_URL`** if you intentionally proxy/custom base.

Research + agent tooling only work if:

- [ ] **`QURAN_COLLECTION_ID`**
- [ ] **`HADITH_COLLECTION_ID`**
- [ ] **`TAFSIR_COLLECTION_ID`**

exist (see §8). Until then **`/research`** will tell you Phase 0 isn’t wired—that’s intentional.

---

## 7 — Cloudflare R2 (only if voice notes matter)

Both **`web`** and **`worker`** need read access for STT/audio fetch semantics used today:

- [ ] **`R2_ACCOUNT_ID`** *(or **`CLOUDFLARE_ACCOUNT_ID`** — same numeric account id)*.
- [ ] **`R2_ACCESS_KEY_ID`**
- [ ] **`R2_SECRET_ACCESS_KEY`**
- [ ] **`R2_BUCKET`** (defaults to **`tranquil-audio`** if omitted—bucket must actually exist).

After setting or changing **`R2_*`**, **`web` must redeploy** so detection re-reads runtime env.

Voice path also requires **worker + Redis** because transcription is queued.

---

## 8 — Phase 0 corpus (Islamic Collections) — only if `/research`/tools must work

Runs **outside Railway** locally or in CI — see **`seeds/README.md`**.

- [ ] In `seeds/`, configure `.env` with **`XAI_API_KEY`**.
- [ ] **`--dry-run`** each script → then real uploads for Quran / Hadith / Tafsir.
- [ ] **`verify.py`** passes.
- [ ] Paste printed collection IDs back into Railway **`web` + `worker`**:
  - `QURAN_COLLECTION_ID`
  - `HADITH_COLLECTION_ID`
  - `TAFSIR_COLLECTION_ID`

This is hundreds of megabytes/API time — bill accordingly.

---

## 9 — Resend + cron (digests/reflection cron)

### Resend (`web`, plus worker if outbound mail originates there—but typically `web`/cron triggers)

- [ ] **`AUTH_RESEND_KEY`** *(naming inherited from repo — it’s Resend).* 
- [ ] **`EMAIL_FROM`** verified domain sender in prod (don’t spoof random domains).

### Cron protection

Cron routes authenticate with:

- [ ] **`CRON_SECRET`** (long random).

HTTP callers must hit e.g. `/api/cron/digest` with **`Authorization: Bearer $CRON_SECRET`** (exact header pattern is enforced in **`src/lib/cron-auth.ts`** — align your Railway Cron or external cron job).

Define Railway scheduled jobs / external monitors per paths in **`vercel.json`** schedule reference if you mirrored that convention.

---

## 10 — Master env matrix (recommended copy-paste discipline)

Paste into **Railway Variables UI** deliberately.

### `web` (Next.js app)

Copy all that apply:

| Variable | Required for |
|----------|----------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk |
| `CLERK_SECRET_KEY` | Clerk |
| `NEXTAUTH_URL` | Link base / cron/email fallbacks |
| `DATABASE_URL` | Everything DB-backed |
| `REDIS_URL` | Queue + chat rate-limit |
| `XAI_API_KEY` | Chat, STT, collections |
| `QURAN_COLLECTION_ID` etc. | Research/tools |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Voice uploads |
| `AUTH_RESEND_KEY`, `EMAIL_FROM` | Digest mail |
| `CRON_SECRET` | Cron routes |
| `XAI_BASE_URL` | Rare override |

See **`.env.example`** for canonical names.

### `worker`

Must match anything jobs touch:

- [ ] **`DATABASE_URL`**
- [ ] **`REDIS_URL`** *(same Redis as web!)*
- [ ] **`XAI_API_KEY`**
- [ ] **`R2_*`** (transcribe pulls audio)
- [ ] Embed/organize may need **`QURAN_COLLECTION_ID`** / user collection tooling — safest to **parity `web` vars** linked from same Railway variable group.

Rebuild/redeploy **`worker`** when env changes—it doesn’t magically pick edits.

---

## 11 — Redeploy / ordering discipline

- [ ] After **any secret rotation** (`REDIS_URL`, Clerk, xAI): **trigger redeploy** on affected services (`web`, `worker`, sometimes Postgres/Redis-linked references).
- [ ] Postgres schema changes: apply **`npm run db:deploy`** on prod (or migrate in CI) **before** expecting new code assumptions — **`docs/PRISMA_MIGRATIONS.md`**.
- [ ] Smoke test **`web`** logs right after redeploy—not just “build succeeded”.

---

## 12 — Smoke tests (five minutes)

- [ ] `GET /` authenticated → renders Today.
- [ ] `GET /notes/new` → textarea works, refresh doesn’t wipe content.
- [ ] `POST` flow for voice ONLY if **`R2_*` + `REDIS_URL` + `worker`** all healthy — watch worker logs during test.
- [ ] **`/research`** query — expect either hits (Phase 0 done) OR explicit configured-empty messaging (collections missing).
- [ ] Cron route with proper **`Authorization`** header returns **401** wrong secret, **non-401** otherwise (don’t blindly publish secret).

---

## 13 — When it still screams

- [ ] **`Internal Server Error` in Safari** ⇒ read **`web` logs** — Next hides stacks from browser.
- [ ] Repeated **`WRONGPASS`** ⇒ fix **`REDIS_URL`** everywhere—it’s Redis auth.
- [ ] Clerk publishable missing ⇒ typo **`NEXT_PUBLIC_`** prefix.
- [ ] Middleware vs random 404 ⇒ check **`src/middleware.ts`** public routes (`/signin`, `/signup`, hyphen variants, cron, heirloom routes).

Good luck—you’re debugging distributed systems stitched by env vars. When it works, Commit to never paste keys into chat screenshots.
