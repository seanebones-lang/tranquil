# Prisma migrations (baseline)

This repo includes an initial **`prisma/migrations/20260521180000_baseline`** migration generated from **`schema.prisma`** (empty → current). Use this for repeatable prod deploys instead of ad-hoc **`db push`** alone.

## Commands

| Command | When |
|--------|------|
| **`npm run db:migrate`** (`prisma migrate dev`) | Local dev: applies pending migrations into your dev DB + updates history. |
| **`npm run db:deploy`** (`prisma migrate deploy`) | Prod / CI / manual shell. **`npm run start`** runs this **automatically before** Next.js (**via `.next/standalone/start-production.mjs`**) so **`web`** deploys migrate inside Railway (**`railway.internal` works there** — not with `railway run` on Mac). |
| **`npm run db:push`** | Quick prototyping against a disposable DB — still supported; not the same history as migrations. |

## Railway: `railway run` → `P1001` (`railway.internal`)

Your **`DATABASE_URL`** usually targets **`postgres-….railway.internal`**. That host is reachable **only inside Railway’s network**.

**`railway run npm run db:deploy`** runs **on your Mac**, with env vars copied in — it **does not** execute inside Railway. You will always see **`P1001`** with a private URL. [Railway CLI `run` docs](https://docs.railway.com/cli/run) state it runs **locally**.

**What this repo does:** **`npm run start`** invokes **`.next/standalone/start-production.mjs`**, which runs **`prisma migrate deploy`** first, **then** starts Next.js standalone. Migrations therefore run **in the deployed `web` container**, where **`railway.internal` resolves.**

**Push and redeploy `web`** — no local migrate required.

### One-off migrate from laptop (actually on Railway hardware)

Uses SSH into the running service (**requires Railway SSH setup**):

```bash
cd /your/tranquil/repo
railway link
railway ssh -s web -- npm run db:deploy
```

([`railway ssh` docs](https://docs.railway.com/cli/ssh))

### Or temporary public URL

Postgres → **Public** TCP → copy **`postgresql://…`** (public host) → `export DATABASE_URL='…'` → `npm run db:deploy` on your Mac **once**.

## Fresh Postgres (recommended)

1. Point **`DATABASE_URL`** at empty database.
2. Run **`npm run db:deploy`** — applies baseline migration.

## Database already populated with `db push` (no `_prisma_migrations`)

Your schema may already match. Options:

**A.** If you confirm schema matches **`schema.prisma`**, mark baseline as applied without re-running DDL:

```bash
DATABASE_URL='postgresql://...' npx prisma migrate resolve --applied 20260521180000_baseline
```

Then future migrations use **`db:deploy`** normally.

**B.** Or snapshot diff and reconcile manually — avoid double-applying incompatible DDL.

## Regenerating SQL from schema

If **`schema.prisma`** changes:

```bash
npx prisma migrate dev --name describe_your_change
```

Commits the migration folder SQL for teammates and prod.
