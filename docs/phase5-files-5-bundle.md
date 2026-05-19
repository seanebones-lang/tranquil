# A Tranquil Space — Phase 5 (final)

The build is complete. This phase wraps everything: the heirloom mechanic
(the feature that makes this app meaningful), markdown export, dynamic daily
reflection, khalwa focus mode, weekly digest, and a full settings page.

## What's new since Phase 4

- **Heirloom system** — end-to-end. Trusted contact email + dormancy
  threshold in Settings → daily cron checks `lastSeenAt` → emails the heir
  a private link → heir lands on `/heirloom-access?token=...` and reads
  notes flagged `isHeirloomVisible` (read-only, with markdown export)
- **Heirloom toggle on every note** — small bookmark icon in the editor
  toolbar marks a note as heirloom-visible (on by default)
- **Markdown export** — `/api/export` supports single note (`?noteId=...`),
  full notebook (authenticated), or full heirloom-visible set (via heir
  token). Citation blocks render as readable blockquotes in the markdown.
- **Dynamic daily reflection** — a morning cron picks each user's most-used
  topic, searches the Quran Collection for a relevant verse, and stores it.
  Today screen reads from that table; falls back to a default verse if no
  reflection has been generated yet.
- **Weekly digest** — Sunday-morning email summarizing the week's notes:
  count, top topics, top 3 to revisit. Skips users with <2 notes that week
  and dedupes by `lastDigestSentAt`.
- **Khalwa mode** — distraction-free fullscreen writing on any note. Toggle
  via the expand icon in the editor toolbar, exit with Escape. The Arabic
  word *khalwa* (خلوة) means retreat or solitude — the term itself becomes
  part of the app's vocabulary.
- **Settings page** at `/settings` — accessibility (font scale, reduced
  motion, ambient sound), heirloom contact + threshold, active grants list
  with revoke, data export, account info
- **Live-applied preferences** — font scale, reduced motion, and contrast
  are read on the server and applied to `html` as data attributes. Changing
  them in Settings updates immediately on the current page, then persists.
- **Vercel cron schedule** — three jobs: 06:00 UTC reflection, 09:00 UTC
  dormancy check, Sundays 14:00 UTC digest

## Required env additions

```
CRON_SECRET=<openssl rand -base64 32>
```

Set the same value in Vercel project settings; Vercel cron will send it as
`Authorization: Bearer <secret>`.

## Try it

```bash
pnpm install
pnpm db:push       # adds HeirloomAccess, User.lastDigestSentAt
pnpm dev
```

### Heirloom flow

1. Go to Settings → Heirloom → enter your own second email + pick "6 months"
2. Manually trigger the cron locally:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/dormancy
   ```
   (It'll skip you since you're not actually dormant.)
3. In Prisma Studio, edit your user's `lastSeenAt` to a year ago, run the
   curl again — you'll get the heirloom email. The link works without auth.

### Daily reflection

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reflection
```

After this runs, refresh Today — the reflection card now shows a verse
matched to one of your most-used topics.

### Weekly digest

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/digest
```

Sends the email if you have at least 2 notes from the last 7 days.

### Export

```bash
# Single note
curl http://localhost:3000/api/export?noteId=<id> --cookie ...

# Full notebook (auth required)
curl http://localhost:3000/api/export --cookie ...

# From a heirloom link, click "Download all notes as text" at the bottom
```

### Khalwa

Open any note. Click the expand icon in the top-right of the editor. The
whole UI melts away — just your title, your prose, your cursor. Press Escape
to come back.

## File map (additions)

```
prisma/
└── schema.prisma                       + HeirloomAccess, User.lastDigestSentAt
src/lib/
├── email.ts                            Resend wrapper + layout template
└── cron-auth.ts                        shared-secret cron auth
src/app/
├── actions/
│   ├── notes.ts                        + setHeirloomVisible
│   └── settings.ts                     updateSettings, revoke grants
├── api/
│   ├── cron/dormancy/route.ts          daily heirloom check
│   ├── cron/reflection/route.ts        daily verse picker
│   ├── cron/digest/route.ts            weekly summary email
│   └── export/route.ts                 markdown export
├── heirloom-access/page.tsx            heir's read-only view
├── settings/page.tsx                   settings shell
└── layout.tsx                          + reads user prefs server-side
src/components/
├── khalwa.tsx                          fullscreen focus mode
├── note-page-chrome.tsx                wraps editor with toolbar + khalwa
├── settings-form.tsx                   accessibility + heirloom controls
└── nav.tsx                             + Settings link
vercel.json                             cron schedule
```

## Costs

The Phase 5 features are nearly free:

| Job | Frequency | Cost per run |
|---|---|---|
| Daily reflection | 1×/day per user | ~$0.0025 (1 Quran search) |
| Dormancy check | 1×/day total | ~$0 (DB query + email if needed) |
| Weekly digest | 1×/week per user | ~$0 (DB query + email) |

Annual cost per active user for Phase 5 features: well under $1.

## Deploy checklist

1. Push to GitHub
2. **Vercel**: import repo, set env vars (don't forget `CRON_SECRET`).
   Vercel cron picks up `vercel.json` automatically. Cron requires Pro plan
   ($20/mo) or higher.
3. **Railway**: worker service (same repo), start command `pnpm worker`.
   Postgres + Redis services in the same project network privately to it.
4. **Cloudflare R2**: bucket `tranquil-audio`, API token, CORS rule (see
   Phase 2 README).
5. **xAI**: API key from console.x.ai. Opt into data-sharing for $175/mo
   free credits if comfortable.
6. **Resend**: verify your sending domain for production (the
   `onboarding@resend.dev` sender works in dev but limits deliverability).
7. Set `QURAN_COLLECTION_ID`, `HADITH_COLLECTION_ID`, `TAFSIR_COLLECTION_ID`
   from your Phase 0 seed runs.
8. Run `pnpm db:push` against the production Postgres URL (or use
   `pnpm db:migrate` for a tracked migration history).

## A few honest notes

**The heirloom feature is the soul of this app for FIL specifically.** It's
the answer to "what happens to all his musings." Test it carefully on real
devices before you tell him about it — once he knows that mechanic exists,
his trust in the app is partly bound to it working. The dormancy cron is
idempotent and only mints one active grant at a time per user, which is
what you want.

**`lastSeenAt` updates on every Today visit and on every sign-in.** It
doesn't update on note editor visits — that's intentional. If FIL stops
opening the home screen, the system rightly considers him dormant.

**Daily reflection requires the Phase 0 Quran Collection.** If
`QURAN_COLLECTION_ID` isn't set, the cron job will error per-user and skip,
and Today will show the default fallback verse. No crash.

**Vercel cron is on a paid plan**. The Hobby tier doesn't include cron. If
you're staying on Hobby, you can replicate this with Upstash QStash
(free tier covers thousands of monthly invocations) hitting the same
`/api/cron/*` URLs with the same `Authorization: Bearer $CRON_SECRET`
header. The code doesn't change.

**Export is markdown, not PDF.** PDF generation needs `@react-pdf/renderer`
(big dependency, ~10MB) or a headless-browser worker. Markdown is the
right canonical export format anyway: it's portable, readable in any text
editor, opens in Notion/Obsidian/etc, and converts to PDF in one shell
command (`pandoc file.md -o file.pdf`). I'd defer adding the PDF endpoint
until FIL actually asks for it.

**Khalwa mode doesn't yet wire up the ambient sound** the user picks in
Settings. The setting persists; the audio playback is a Phase 6 polish
item if you want it. Mechanically straightforward — an `<audio>` element
inside `KhalwaShell` that streams a looping file from R2.

**Settings preferences need a `data-contrast` style rule** to actually do
something for the high-contrast option. I added the data attribute hook
in globals.css and the layout, but the `data-contrast="high"` selector
isn't written yet — that's a 10-line addition to globals.css when you
need it (boost text contrast, darken muted, etc).

## What you have now

- **Today** — greeting, push-to-talk, dynamic reflection, recent notes
- **Notes** — timeline / topics / search; full editor with auto-save,
  related notes, slash commands, read/write toggle, khalwa, export,
  heirloom toggle
- **Research** — Quran/Hadith/Tafsir search with mandatory citations, verse
  modal with four translations + tafsir + audio recitation
- **Library** — saved citations grouped by source
- **Ask the app** — floating agent with 5 tools and web search, persistent
  threads, history
- **Settings** — accessibility, heirloom config, data export
- **Heirloom access** — read-only inheritance for a trusted contact
- **Cron jobs** — dormancy check, daily reflection, weekly digest
- **Worker** — STT, organize, embed pipelines on Railway
- **Mobile** — PWA installable, mobile-first layout, push-to-talk pointer
  capture, large touch targets

You're done. Ship it to FIL.

## What to do this week

1. Run all Phase 0–5 deploys end-to-end on your phone
2. Buy `atranquilspace.com` (or whatever final URL); point at Vercel
3. Verify your sending domain in Resend
4. Sign up FIL with a magic link; sit with him for 20 minutes the first
   time he uses it; watch which buttons he taps and which he doesn't
5. Read his first week of notes through the heirloom export to validate
   that flow works
6. Send the family a quiet email letting them know the app exists, in case
   any of them ever get the heirloom message

That's the whole build. Reply if you want Phase 6 polish (ambient audio in
khalwa, PDF export, tool-result hydration in chat history, public note
publishing, search index for citations), or if you hit anything weird during
the deploy. Otherwise — go ship.
