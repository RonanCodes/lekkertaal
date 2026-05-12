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

## Drill components (US-009..US-014)

Every drill component lives in `src/components/drills/`:

- `DrillFrame.tsx` — shared shell: prompt header + body slot + feedback strip.
  Exports `FeedbackBanner`, `levenshtein()`, `normaliseAnswer()`, `gradeText()`.
- `Speaker.tsx` — speaker-icon button. Calls `/api/tts?text=...&voice=...`
  (US-029 endpoint). Degrades silently to an idle state when 404/501.
- `DrillRenderer.tsx` — dispatch by `drill.type`. Exports `parseField<T>()`
  helper which JSON-parses `options`/`answer` (those are shipped as JSON
  strings, see below).

Each drill component takes:
```ts
{ drill: DrillPayload; onSubmit: (correct: boolean, userAnswer?: string) => void }
```
…and is responsible for its own state. Call `onSubmit` once after a short
feedback hold (600–800 ms) so the player parent can advance.

## TanStack Start serializability gotcha (US-009)

Server-fn return types must be plain-serializable for TanStack Start's
transport. `drizzle` columns declared with `{ mode: "json" }` come back as
`unknown[]` / `unknown` which trips the type check.

Fix: re-serialise to JSON strings on the server-fn boundary, then parse
client-side with `parseField<T>()` from `DrillRenderer.tsx`:

```ts
// server
options: d.options == null ? null : JSON.stringify(d.options),
answer:  d.answer  == null ? null : JSON.stringify(d.answer),

// client
const opts = parseField<MyType[]>(drill.options) ?? [];
```

## Levenshtein-tolerant text grading

`gradeText(user, canonical)` in `DrillFrame.tsx`:
- lowercase, trim, strip `.,!?;:"'()`, collapse whitespace
- accept Levenshtein distance ≤ 1 (one typo)
- use for translation typing, fill-blank, and word ordering

For multi-answer drills, accept a string-array canonical and `.some()` over it.

## Skip the routeTree.gen.ts manual edit

The TanStack plugin regenerates `src/routeTree.gen.ts` on every Vite build.
Don't try to edit it manually. If `pnpm exec tsc --noEmit` complains about a
new route, run `pnpm build` once to regenerate the tree, then re-check.
