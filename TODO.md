# A Tranquil Space — Full Code Review TODO

> **Historical note:** This file predates parts of today’s stack (e.g. **Clerk** replaced NextAuth, Prisma migrations were added separately). Entries reflect what was audited at paste time — confirm against current code rather than trusting `[x]` for auth-related items.

Generated from senior dev team review. Work through these systematically.

---

## CRITICAL BUGS

- [x] Fix `package.json` start script — remove redundant `npm run build` from `start` (build is Railway's build step, not runtime)
- [x] Add `EMAIL_FROM` guard — throw at startup if not set in production (root of Resend loop)
- [x] Fix `auth.ts` — remove redundant double `pages` spread, harden callback merge
- [x] Fix `RootLayout` — skip DB query entirely when no session (waterfall on every public page)
- [x] Fix `NoteEditor` status polling — stacking intervals on every re-render (memory leak)
- [x] Fix dead code — `aiSummary ?? n.bodyMd.slice(0, 120) ?? ""` (last `??` is unreachable)

## SECURITY / INFRA

- [x] Add rate limiting to `/api/chat` (unauthenticated cost vector)
- [x] Add security headers — CSP, `x-robots-tag: noindex` for auth routes — in `next.config.ts`

## CSS / DARK MODE

- [x] Fix dark mode — `--color-paper-dark` etc defined but never reassigned to CSS vars; all components stay light in dark OS mode

## UX / UI FIXES

- [x] Fix mobile FAB overlap — add bottom padding to all page `<main>` so last card isn't hidden behind the FAB
- [x] Fix note delete — replace native `confirm()` (breaks PWA/iOS) with inline confirmation row
- [x] Add Khalwa mode fade-in — snap-to-fullscreen feels jarring; should cross-dissolve
- [x] Add "Check your spam" copy on check-email page — critical for new users during Resend domain warmup

## EDITOR ENHANCEMENTS

- [x] Add word count + character count display to `NoteEditor` (live, below textarea)

## FEATURES

- [x] Add Research page empty/onboarding state (currently just a floating search box)
- [x] Add note search bar on `/notes` page backed by existing vector search
- [x] Wire reflection `responseNoteId` — add "Respond to this" button on Today page that opens a pre-seeded note with the verse cited
- [x] Surface voice note duration in UI (`NoteAudio.durationSec` stored but never shown)
- [x] Add writing streak counter to Today page (schema has `lastSeenAt`, add `currentStreak` computed field)
- [x] Finish heirloom-access page UI (schema + email logic is 70% done, UI is stub)
- [x] Improve export — add date range filter + per-note download option

---

## STATUS KEY
- [ ] = todo
- [x] = done
