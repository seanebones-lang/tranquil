# A Tranquil Space — Seed scripts (Phase 0)

One-time scripts that build the three shared Grok Collections the app queries
against. After they finish, the app has zero external dependencies for
Quran/Hadith/Tafsir lookups — everything is RAG over xAI's own infrastructure.

What gets created:

| Script | Collection name | ~Documents | Source | Approx time |
|---|---|---|---|---|
| `seed_quran.py` | `tranquil-quran` | 6,236 | alquran.cloud (Tanzil text) | 20–40 min |
| `seed_hadith.py` | `tranquil-hadith` | ~34,000 | fawazahmed0/hadith-api | 90–120 min |
| `seed_tafsir.py` | `tranquil-tafsir` | 6,236 | spa5k/tafsir_api (Ibn Kathir EN) | 20–40 min |

Each script produces a `COLLECTION_ID` printed at the end — save those to
`.env` so the Next.js app can find them.

## Setup

```bash
cd seeds
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env: paste your xAI key
```

## Run

Always do a `--dry-run` first to confirm the document shape looks right:

```bash
python seed_quran.py --dry-run
python seed_hadith.py --dry-run
python seed_tafsir.py --dry-run
```

If the printed sample documents look correct, run for real (in three separate
terminals, in parallel):

```bash
python seed_quran.py
python seed_hadith.py
python seed_tafsir.py
```

You can adjust concurrency: `--workers 8` doubles throughput if rate limits allow.

After all three finish, verify with:

```bash
python verify.py
```

That runs one search against each collection and prints a sample result.

## Flags

- `--dry-run` — build documents but do not upload. Prints 2 sample documents
  to stdout. Always do this once before the real run.
- `--reset` — delete the existing collection (matched by name) and recreate.
  Use if you want a clean re-seed.
- `--workers N` — concurrent upload threads (default 4). Bump if you don't hit
  rate limits.

## Re-running

By default, re-running a seed script with the same collection name appends
duplicates. Use `--reset` to wipe and recreate. The `--reset` flag is destructive
and will permanently delete the named collection — you will lose any documents
in it.

## Troubleshooting

**`xai-sdk not installed`** — `pip install -r requirements.txt` inside your venv.

**`XAI_API_KEY not set`** — make sure `.env` exists in this directory and
contains the key. The scripts use `python-dotenv` to load it.

**API surface drift** — the Collections API is relatively new. If you see
errors like `AttributeError: 'Client' object has no attribute 'collections'`,
the SDK has changed shape since this was written. Check `pip show xai-sdk` for
your version and the xAI docs at https://docs.x.ai for current method names.
The scripts assume the documented `client.collections.create/list/delete/upload_document`
API surface.

**Rate limits** — if uploads start failing in clusters, lower `--workers` to 2.
xAI's rate limits for Collections uploads aren't published; conservative
defaults are safer than hitting throttling.

**Partial upload** — if a script dies partway, you have two options:
1. `--reset` and re-run from scratch (cleanest)
2. Re-run without `--reset` (creates duplicates for already-uploaded verses,
   but Collections search will still work — just a bit redundant)

## Cost

Document uploads themselves are not billed as Collections queries (those are
search-time, $2.50 / 1K calls). Embedding generation on upload is included.
The full seed costs ~$0 in API spend.

## Notes on sources

- **Quran text** is from Tanzil.net via the alquran.cloud REST API. Tanzil's
  Quran is openly licensed for non-commercial use; commercial use needs their
  permission. For a personal project this is fine.
- **Hadith** comes from fawazahmed0/hadith-api, which aggregates from various
  open sources. Gradings are included where the source data provides them.
  Bukhari and Muslim are entirely Sahih by scholarly consensus; the other four
  collections (Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah) have per-hadith grading
  that the app surfaces with each citation.
- **Tafsir Ibn Kathir** (English, abridged) is from spa5k/tafsir_api, a widely
  used open dataset.

All three are appropriate for personal study and a private app. If you ever
productize this, double-check each source's license.
