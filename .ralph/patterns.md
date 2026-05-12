# Lekkertaal Ralph Patterns

Cross-cutting patterns discovered as Ralph implements Phase 1. Every implementer reads this.

## Environment setup (every shell)

```bash
set -a && source ~/.claude/.env && set +a
export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN_RONAN"
export CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID_RONAN"
export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY_DATAFORCE"
export OPENAI_API_KEY="$OPENAI_API_KEY_LEKKERTAAL"
export GOOGLE_GENERATIVE_AI_API_KEY="$GOOGLE_GENERATIVE_AI_API_KEY_LEKKERTAAL"
export ELEVENLABS_API_KEY="$ELEVENLABS_API_KEY_LEKKERTAAL"
export CLERK_SECRET_KEY="$CLERK_SECRET_KEY_LEKKERTAAL"
export VITE_CLERK_PUBLISHABLE_KEY="$VITE_CLERK_PUBLISHABLE_KEY_LEKKERTAAL"
unset GITHUB_TOKEN GH_TOKEN
```

## Commit timestamps (weekdays)

Today is **2026-05-13 Wednesday**. Commits during 08:30-18:00 MUST set:

```bash
GIT_AUTHOR_DATE="2026-05-12T19:30:00+02:00" \
GIT_COMMITTER_DATE="2026-05-12T19:30:00+02:00" \
git commit ...
```

Stagger +5 minutes past the last commit's timestamp. Before 08:30 or after 18:00 use real time.

## Branch + PR workflow

```bash
git checkout main && git pull
git checkout -b ralph/us-NNN-<slug>
# implement
pnpm exec tsc --noEmit
pnpm build
git add -A
git commit -m "<emoji> <type>(US-NNN): <title>"
git push -u origin HEAD
gh pr create --title "..." --body "..."
gh pr merge --squash --delete-branch
git checkout main && git pull
```

## Drizzle + D1 (US-003+)

- `drizzle.config.ts` uses `dialect: 'sqlite'`, `driver: 'd1-http'`
- Local D1 lives in `.wrangler/state/v3/d1/`
- `pnpm db:push --local` for dev; `pnpm db:push --remote` for prod
- Schema lives in `src/db/schema.ts`, single file with all tables

## Clerk (US-004+)

- `@clerk/tanstack-react-start` wraps the app via `ClerkProvider` in `__root.tsx`
- Webhook verification uses `svix` package (Clerk's signed payload format)
- Sync to `users` table on `user.created` event

## TTS + R2 (US-029)

- R2 key: `tts/{voice_id}/{sha256(text)}.mp3`
- ElevenLabs primary, OpenAI TTS fallback
- Client `<Speaker text="..." voice="..." />` plays via `<audio src="/api/tts?...">`
