# Documentation

| Document | Description |
|---------|-------------|
| [MANUAL_PRODUCTION_CHECKLIST.md](./MANUAL_PRODUCTION_CHECKLIST.md) | **Operational punch list**: Railway Postgres/Redis/`web`+`worker`, Clerk, env matrix, smoke tests |
| [PRISMA_MIGRATIONS.md](./PRISMA_MIGRATIONS.md) | **`npm run db:deploy`** vs **`db:push`**; baseline migration + existing DB caveat |
| [TODO_100_OF_100.md](./TODO_100_OF_100.md) | Verify integration end-to-end (middleware, migrations, CI, seeds, worker, cron) |
| [BUILD_PLAN.md](./BUILD_PLAN.md) | Architecture, phased roadmap, costing — snapshot of routes/components (**Clerk**, Prisma, env) |
| [../seeds/README.md](../seeds/README.md) | Phase 0 — Grok Collections seed scripts |

**Historical zips:** `phase*-bundle.md` READMEs describe partial exports; detail may lag current **Clerk** stack — verify against live code.


## Audit Status
Core described functionality (Clerk auth, voice R2 pipeline + worker, research Collections, chat, heirloom, cron middleware, organize/embed jobs) is implemented and matches the documentation.
One fix made: Removed legacy Auth.js models from Prisma schema.

