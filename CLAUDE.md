# Lekkertaal — project conventions

A Duolingo-class Dutch learning PWA. Per-user drills + boss-fight AI roleplay scenarios, gamification (streaks / coins / freezes / badges / leaderboard), notifications (web push + email). Built on the golden stack: TanStack Start + Cloudflare Workers + D1 + Drizzle + shadcn + Clerk + Vercel AI SDK + ElevenLabs.

## Skills to load when working in this repo

The harness picks these up by fuzzy match; this list is the explicit hint so you don't have to wait for the match.

### Always relevant

- **`/ro:vercel-ai-sdk`** — load before adding or modifying ANY AI feature (chat, streaming, structured output, tool calling, prompt caching, multimodal). Covers Core + UI primitives, provider tricks, the v6 wire protocol, CF Workers edge gotchas, and the four sites in this repo that already use the SDK (`src/lib/server/roleplay.ts`, `src/routes/api.roleplay.$slug.stream.ts`, `src/routes/app.scenario.$slug.tsx`, `src/lib/models.ts`).
- **`/ro:cf-ship`** — anything that touches deploy / D1 migrations / wrangler secrets.
- **`/ro:write-copy`** — every user-facing string, every commit body, every doc page.

### Conditional

- **`/ro:clerk`** when wiring auth flows beyond the existing webhook + middleware.
- **`/ro:posthog`** when wiring analytics events (already initialised, just consult the skill before adding new events).
- **`/ro:sentry`** when adjusting error reporting (already initialised; consult before swapping DSN / sampling).
- **`/ro:tts-elevenlabs`** when changing the TTS pipeline or adding new voices.
- **`/ro:sfx-elevenlabs`** when regenerating the SFX bank in `public/sfx/`.

## Stack snapshot

| Layer | Pick |
|---|---|
| Framework | TanStack Start (v6 router) on Cloudflare Workers |
| DB | D1 (`lekkertaal_db`, uuid `ca05c5b2-512c-4007-88a6-b2499e4cbd12`) via Drizzle |
| Auth | Clerk (open Google + email signup, instance `vital-molly-59`) |
| AI | Vercel AI SDK v6, Claude Sonnet 4.6 primary, OpenAI / Gemini as alts |
| TTS | ElevenLabs (cached in R2 bucket `lekkertaal-tts`) |
| Email | Resend |
| Push | Web Push API + VAPID (keys in wrangler secrets) |
| Logging | Logtape (console + Sentry sinks); `log.info(...)`, `?debug=1` per-request override |
| Tests | Vitest (unit + integration via `better-sqlite3` :memory:) + Playwright (e2e + Clerk testing token) |

## Conventions

### Workflow

PR-only on `main`. Branch → push → PR → CI green → squash-merge via `gh api PUT .../pulls/<n>/merge` (the gh CLI's local config has a JSON parsing bug; the REST endpoint works fine). Never `git push origin main`. Never `--admin`.

### Commits

Emoji-conventional: `<emoji> <type>(scope?): <description>`. No Co-Authored-By line. Weekday timestamps must fall outside 08:30–18:00 local (set `GIT_AUTHOR_DATE` + `GIT_COMMITTER_DATE`).

### Dev login

Default flow: sign in via Clerk hosted UI on first run, session persists for hours.

Shortcut: `pnpm dev:bypass-auth` toggles `DEV_BYPASS_AUTH=true` in `.dev.vars` for the lifetime of the session and auto-signs-in as `seed_ronan`. Restores `.dev.vars` on Ctrl+C. NEVER set `DEV_BYPASS_AUTH=true` in `wrangler.jsonc` vars — production safety. See `src/lib/server/auth-helper.ts` for the bypass condition.

### Auth gate pattern in server functions

```ts
const userId = await requireUserClerkId();  // throws redirect to /sign-in if unauth
const { env } = requireWorkerContext();
```

`requireUserClerkId` lives in `src/lib/server/auth-helper.ts`. `requireWorkerContext` lives in `src/entry.server.ts` and has a dev-only globalThis fallback because TanStack Start's server-fn RPC loses the AsyncLocalStorage scope in Vite dev.

### Logging

```ts
import { log } from "../logger";

log.info("user signed in", { userId, plan: "free" });
log.debug("drill graded", { drillId, ok, attempts });
log.error("TTS fetch failed", { text, voiceId, status, err });
```

Bump verbosity per request: `?debug=1` or `x-lekkertaal-debug: 1`. Global: `LOG_LEVEL=debug` in wrangler vars. Tail prod: `wrangler tail lekkertaal --format=pretty`.

### Operator inventory

- Domain: `lekkertaal.ronanconnolly.dev` on the personal Cloudflare account (NOT Simplicity Labs)
- D1: `lekkertaal_db`, UUID `ca05c5b2-512c-4007-88a6-b2499e4cbd12`
- R2: `lekkertaal-tts` (cached audio)
- VAPID + Clerk + Anthropic + OpenAI + Google + ElevenLabs + Resend keys: pushed as wrangler secrets; public Clerk + LOG_LEVEL keys live in `wrangler.jsonc` vars
- Seed: `pnpm seed:users --remote` re-populates 4 demo users; `pnpm seed:ingest` rebuilds course content from `seed/*.json`

## What's in the PRD vs what's shipped

`.ralph/prd.json` has the full Phase 1 v0 plus Phase 2-4 roadmap (≈100 stories). Phase 1 v0 is fully shipped (38 PRs merged as of 2026-05-14). Phase 2 stories (STT, friends, peer drills, more A1+B1 content) are scoped but unstarted.

`.ralph/phase-1-summary.md` captures the v0 ship state and known TODOs.
