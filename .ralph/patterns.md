## Codebase Patterns (Lekkertaal)

This is the durable knowledge surface for the local factory running on this repo. Read at every iteration start; the orchestrator harvests new learnings into this file at session close. Worker-scratch files under `.ralph/sessions/` are ephemeral.

### Stack + conventions

- TanStack Start + Cloudflare Workers + D1 + Drizzle. Server fns via `createServerFn({ method })`.
- Auth: `requireUserClerkId()` + `ensureUserRow()` at the top of any auth-gated server fn. Auth-gate redirect: `throw redirect({ to: '/sign-in' })` from `@tanstack/react-router`. NEVER `throw new Error("Not signed in")` — TanStack Start surfaces that as a 500, not a 302.
- Worker context: `requireWorkerContext()` to read `env.DB`, `env.TTS_CACHE`, etc.
- Lucide icons everywhere; NO emojis in user-facing UI. Lucide imports MUST be static (`import { Foo } from "lucide-react"`), never dynamic — runtime string-to-component lookup defeats tree-shaking.
- Commit format: emoji + conventional (`✨ feat` / `🐛 fix` / `🧹 chore` / `📝 docs` / `🧪 test` / `♻️ refactor`). NO Co-Authored-By.
- Weekday commit timestamps must fall OUTSIDE 08:30–18:00 local time. If committing inside the window on Mon–Fri, set `GIT_AUTHOR_DATE` + `GIT_COMMITTER_DATE` to either today's morning before 08:30 OR last night after 18:00. Use the same backdate across every commit in one iteration so they stay sequential. The Husky pre-push hook does NOT enforce this — subagent prompts must do it.

### Drill system

- Seed `exercises.type` uses hyphens (`match-pairs`, `listening-spell`); the `DrillType` union uses underscores. Normaliser: `src/lib/server/lesson.ts` → `normaliseDrillType`. Always add BOTH ends when introducing a new type.
- Synthetic drills (no row in `exercises`) carry `isSynthetic: true` so the lesson player skips `recordDrillResult`. See `buildFlashcardTail`, `buildListeningSpellTail`.
- **Synthetic-drill negative-id ranges must not collide.** Claim a 1M-id-band per tail builder. Flashcards: `-1_000_000 - lessonId*100 - i`. Listening-spell: `-2_000_000 - lessonId*100 - i`. Next builder claims `-3_000_000`.
- Per-pair tracking: `recordVocabPairResult({ nl, en, correct })` upserts misses into `spaced_rep_queue` under `itemType: "vocab_pair"`, key `<nl>|<en>` lowercased.
- Per-exercise tracking: `recordDrillResult({ exerciseId, correct, userAnswer })` upserts misses under `itemType: "exercise"`. Use this for sentence-shaped drills (translation, word-bank, dialogue-reply) where the unit is the sentence, not a pair.
- `parseField<T>` in `DrillRenderer.tsx` JSON-parses the answer/options field. Plain string answers in seed are stored as `JSON.stringify("ik wil een koffie")` — even single-word fixtures need to be JSON-encoded in tests, NOT bare strings.
- Drill components carry `data-testid` hooks for Playwright. Pattern: `<drill-type>-<role>` (e.g. `listening-spell-input`, `match-pairs-nl-0`). Mandatory for any new drill type.
- "Close enough" / near-miss tolerance uses `levenshtein` from `src/lib/server/levenshtein.ts`. Thresholds: 1 for single-word listening-spell, 3 for sentence-level translation-typing. Diacritics count as character substitutions (`levenshtein("één", "een") === 2`).

### Spaced repetition

- `MAX_ACTIVE_REVIEWS = 200`. Eviction fires on insert N+1, not on insert N — seeding exactly 200 leaves all 200 in place.
- `buildFlashcardTail` biases 70/30 toward due `vocab_pair` queue rows that intersect the unit pool. Empty queue OR no intersection → falls back to uniform pool sampling.
- 20-trial probabilistic guard pattern catches over-broad spaced-rep queries (e.g. a missing `itemType` filter would surface non-vocab rows). Keep using it for new spaced-rep work.

### Audio + TTS

- Speaker component: `src/components/drills/Speaker.tsx`. Hits `/api/tts` which goes Wikimedia Commons (single Dutch word, free) → OpenAI fallback (`gpt-4o-mini-tts`, multi-word). ElevenLabs deprecated behind `ELEVENLABS_ENABLED="true"` wrangler var (default `"false"`).
- Slow playback: set `audio.playbackRate = 0.5` BEFORE `play()` for Safari first-frame correctness. Speaker writes `data-last-playback-rate` on its wrapper as a Playwright hook so tests can assert the rate without stubbing the Audio constructor.
- Wikimedia Commons audio URL is computable from `md5("Nl-<word>.ogg")`: `commons/transcoded/<h0>/<h0h1>/Nl-<word>.ogg/Nl-<word>.ogg.mp3`. No MediaWiki API call needed at runtime. iOS Safari MP3-compatible via the auto-transcoded sibling URL.
- Cloudflare Workers `crypto.subtle.digest("MD5", ...)` is a Cloudflare extension that doesn't exist in Node webcrypto. For code that runs in BOTH the Worker AND vitest (helpers exercised in tests), use `node:crypto.createHash('md5')` via `nodejs_compat`.

### Testing

- Vitest harness: `src/lib/server/__tests__/test-db.ts` (better-sqlite3 in-memory D1). Exports `makeTestDb`, `asD1`, `seedUser`. `seedUser` defaults the user's timezone to UTC so date-based tests don't fail at midnight CEST.
- TanStack server functions (`createServerFn(...).handler(...)`) thread through AsyncLocalStorage + Clerk auth that don't exist in vitest. Test the INNER Drizzle query directly, not the server-fn wrapper.
- better-sqlite3 vs D1: in-memory is strictly faster than D1 over network. Use for latency-budget validation but treat as upper bound, not 1:1. Real-D1 latency in CI would need miniflare; not in scope today.
- jsdom has no Audio implementation: stub the global with a real class (`vi.stubGlobal('Audio', class { ... })`), NOT `vi.fn().mockImplementation()` — the latter isn't usable as a constructor.
- jsdom has no layout engine: assert mobile-first ≥44px touch targets via className regex (`min-h-[44px]`), not computed style.
- Tailwind has no `(pointer: coarse)` variant out of the box; use the arbitrary-variant escape hatch `[@media(pointer:fine)]:inline-flex`.
- Playwright e2e harness lives under `e2e/auth/` with the `signInViaBypass` helper that sets the `x-lekkertaal-e2e-bypass` header. Specs gate on `isClerkTestingConfigured()` and `test.skip` cleanly when `E2E_BYPASS_TOKEN` is unset.
- E2e canonical-answer escape hatch: `data-canonical-answer="..."` attribute on a drill root, never rendered visually, pipe-joined for multi-canonical drills. Lets Playwright type the right thing without DOM scraping.
- Per-cell grading inspection: `data-correct="true|false"` on each cell beats parsing tailwind border classes.
- Shared e2e skip-loop pattern (walk into a2-unit-1 → first lesson → click through drills until target type appears) is repeated across 5+ specs. **Worth extracting into `e2e/setup/lesson-nav.ts` next time someone touches a drill spec.**
- **Every new drill type / user-visible feature ships with unit + integration + e2e in the SAME PR.** The drill-catalogue night-shift had to do a retroactive 3-PR e2e sweep because the original DoD only required unit. New PRDs MUST list e2e in the acceptance criteria.

### PR + merge flow

- PR-only on `main`. Branch → push → PR auto-opens CI → wait for green → squash-merge via `gh api -X PUT repos/RonanCodes/lekkertaal/pulls/<n>/merge -f merge_method=squash`. NEVER `git push origin main`. NEVER `gh pr merge --admin`.
- The gh CLI has a JSON-parsing bug on `gh pr merge` for some configs; the `gh api` REST endpoint avoids it. Use `-X PUT` form (NOT `gh api PUT ...` — the `-X` is required).
- For polling CI: `gh pr checks <n>` returns plain text reliably. `gh pr checks <n> --json state,conclusion` hits the JSON parse bug; prefer `gh api repos/<owner>/<repo>/commits/<sha>/check-runs --jq '.check_runs[]'` if you need structured output.
- Husky pre-push runs typecheck + lint + tests. Local CI is the trust signal; GH Actions runs the same gauntlet post-push but waiting for it is OPTIONAL when the pre-push has covered the gauntlet (per the lekkertaal swarm lesson, 2026-05-14).
- Auto-merge on green CI per the personal-repo memory rule: no second confirmation; squash-merge as soon as checks pass.

### Local factory hooks

- This repo participates in the **local factory** (`/ro:ralph`, `/ro:planner-worker`, `/ro:matt-pocock-coding-workflow`, `/ro:night-shift`, `/ro:day-shift`). See `~/Dev/ronan-skills/skills/ralph/SKILL.md` § "Run artefacts (the canonical shape)" for the canonical reference.
- Artefact shape:
  - `.ralph/patterns.md` (this file) — committed, durable, harvested at session close.
  - `.ralph/<phase>.session.md` — committed, per-session aggregate.
  - `.ralph/sessions/<session-id>/<worker-id>.md` — gitignored worker scratch; dies at session close after harvest.
  - `.ralph/<phase>.json` (PRD) — committed.
- The companion **remote factory** is the Factory app (tracked separately) that will run equivalent loops as a cloud service. Story formats and PR conventions are kept compatible.
