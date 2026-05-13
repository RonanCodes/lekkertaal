# Lekkertaal

A Duolingo-style Dutch-learning app, tuned for the Yellowtail Dutch Group. Live at https://lekkertaal.ronanconnolly.dev.

## Stack

- **TanStack Start** (React 19, file-based routing, server functions, SSR)
- **Cloudflare Workers** runtime via `@cloudflare/vite-plugin`
- **D1** (`lekkertaal_db`) for data, **Drizzle ORM** for schema and queries
- **R2** (`lekkertaal-tts`) for cached TTS audio
- **Clerk** for auth (Google + email)
- **Tailwind 4** + shadcn/ui for primitives; **motion/react** for animation
- **Vercel AI SDK** for roleplay grading and chat (Anthropic + OpenAI + Google)
- **ElevenLabs TTS** with OpenAI TTS fallback
- **Cron worker** (hourly) for streak nags, weekly digests, SR reminders

## Local dev

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # produces dist/server + dist/client
pnpm typecheck
```

Secrets for local dev live in `.dev.vars` (gitignored). Copy from `~/.claude/.env` if rebuilding the box. See `.dev.vars.example` for the full key list.

### Localhost auth bypass (dev only)

Clicking through Clerk's hosted UI on every dev restart gets old. To auto-sign-in as a fixed seed user when `pnpm dev` is running, add this line to `.dev.vars` and restart the dev server:

```
DEV_BYPASS_AUTH=true
```

You will be signed in as the `seed_ronan` clerk-id placeholder, which matches the "Ronan" demo row from `seed/users.json`. Run `pnpm seed:users` once first so the row exists in local D1.

The bypass is **localhost-only**. Two locks: (1) the helper checks `import.meta.env.DEV`, which Vite statically replaces with `false` in the production build (the bypass branch is dead-code-eliminated from the deployed worker), and (2) `wrangler.jsonc` vars MUST never set `DEV_BYPASS_AUTH=true` — only `.dev.vars` may do so.

## Database (Drizzle + D1)

```bash
pnpm db:generate         # generate migrations from src/db/schema.ts
pnpm db:push:local       # apply migrations to local D1
pnpm db:push:remote      # apply migrations to prod D1
pnpm seed:ingest         # rebuild seed/*.json from llm-wiki vault
pnpm seed:load           # load seed/*.json into D1
```

## Deploy

```bash
pnpm deploy              # vite build + wrangler deploy
```

`wrangler.jsonc` defines the custom domain (`lekkertaal.ronanconnolly.dev`), D1 binding, R2 binding, cron trigger, and public vars.

## Repo layout

```
src/
  routes/         file-based routes (TanStack Router)
  db/             Drizzle schema + queries
  lib/            shared helpers (auth, ai, tts, prompts, …)
  components/     UI components (drills, mascot, chat, shop, …)
  data/           static data (placement test, scenario seeds)
seed/             generated seed JSON (ingested from llm-wiki)
scripts/          tsx scripts (seed-ingest, seed-load)
drizzle/          generated migrations
.ralph/           PRD + Ralph progress + patterns
public/           static assets (mascot SVGs, audio, manifest, icons)
```

## Status

Phase 1 v0 build in progress under Ralph. See `.ralph/progress.txt`.
