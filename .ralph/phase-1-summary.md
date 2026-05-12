# Phase 1 — `phase-1-v0` — summary

Run completed 2026-05-13 (Wednesday evening session).

## Scope

Phase 1 covered US-001 through US-035 (35 stories). At session start, 17
were already merged. This session shipped the remaining 18 stories plus
one new bug (BUG-002) found during smoke-testing the earlier work.

## Stories merged this session

| Story | Title | PR |
|---|---|---|
| BUG-002 | Authed routes redirect to /sign-in instead of 500 | #15 |
| US-017 | Roleplay chat at /app/scenario/:slug | #16 |
| US-018 | Roleplay grading + 5-rubric scorecard | #17 |
| US-019 | Errors → spaced repetition queue (SM-2) | #18 |
| US-020 | XP + coins + streak engine | #19 |
| US-021 | Coins shop at /app/shop | #20 |
| US-022 | Streak freeze auto-consume + milestone awards | #21 |
| US-029 | ElevenLabs TTS + R2 cache (with OpenAI fallback) | #22 |
| US-023 | 15-badge auto-award engine + profile grid | #23 |
| US-024 + US-025 | Leaderboard + public profile | #24 |
| US-026 | Users directory | #25 |
| US-027 | Web push daily nag via existing cron | #26 |
| US-028 | Weekly digest + streak recovery email | #27 |
| US-031 | Stroop mascot (animated SVG fallback) | #28 |
| US-032 | Hero SFX hook + settings page | #29 |
| US-033 | PWA manifest + service worker | #30 |
| US-034 | Production deploy verification | #31 |
| US-035 | Seed 4 demo users for the leaderboard | #32 |

Total: **17 PRs** (US-024 and US-025 shipped together because the
leaderboard rows linked to the public profile route).

## Stories blocked

None. Every story listed for this session merged with green CI.

## Smoke results — production app

`curl` against `https://lekkertaal.ronanconnolly.dev` post-final-merge:

- `/` → HTTP 200, ~5.5 KB HTML
- `/app/path` → HTTP 307 → `/sign-in` (BUG-002 fix in production)
- `/manifest.json` → HTTP 200, `application/json`, name = "Lekkertaal",
  theme_color = `#FF6B1A`
- `/sw.js` → HTTP 200, `text/javascript`

All four pass.

## Carry-overs / TODOs

Marked with `TODO(refinement)` or `TODO(US-NNN)` in code; these are
deliberate scope cuts to keep PRs shippable:

- US-017: tap-to-hear `/api/tts` is wired but the chat scene's own
  `SpeakButton` still uses an inline implementation. Switch to the
  new `<Speaker>` component for consistency.
- US-018: continue button on the scorecard routes to `/app/path`, not
  to a next-unit recommendation. Once boss-fight gating ships, route
  to next unit.
- US-023: Stroop full-screen celebration on badge award. The award
  pipeline returns `newBadges`; the celebration UI is unwired pending
  Stroop's design final.
- US-027: web push notifications carry no encrypted payload; the SW
  renders a generic Dutch reminder. Streak-specific copy lands when we
  wire the AES-128-GCM ECDH path.
- US-031: the SVG Stroop is an animated stand-in. A real `.riv` state
  machine with the Nano Banana 2 sketches is the v1 follow-up.
- US-032: actual mp3 generation (correct-ding, wrong-buzz,
  lesson-complete-fanfare, streak-fire-whoosh) is operator setup via
  `/ro:sfx-elevenlabs` → `public/sfx/*.mp3`. The hook silently no-ops
  when files are missing.

## Required operator setup before all features go live

Push these secrets via `wrangler secret put`:

- `VAPID_PUBLIC`, `VAPID_PRIVATE` (PKCS8 base64url), `VAPID_SUBJECT`
  (for US-027 web push)
- `RESEND_API_KEY` (for US-028; also verify
  `lekkertaal.ronanconnolly.dev` in the Resend dashboard)
- `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` are already set per the
  Phase 1 setup checklist.

Run `pnpm seed:users --remote` once after deploying US-035 to populate
the leaderboard.
