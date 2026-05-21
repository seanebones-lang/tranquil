# Prisma migrations (baseline)

This repo includes an initial **`prisma/migrations/20260521180000_baseline`** migration generated from **`schema.prisma`** (empty → current). Use this for repeatable prod deploys instead of ad-hoc **`db push`** alone.

## Commands

| Command | When |
|--------|------|
| **`npm run db:migrate`** (`prisma migrate dev`) | Local dev: applies pending migrations into your dev DB + updates history. |
| **`npm run db:deploy`** (`prisma migrate deploy`) | **Production / Railway:** applies committed migrations against **`DATABASE_URL`**. Run after deploy or as a Railway “Release” / one-off shell step. |
| **`npm run db:push`** | Quick prototyping against a disposable DB — still supported; not the same history as migrations. |

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
