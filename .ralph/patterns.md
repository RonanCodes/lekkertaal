## Codebase Patterns (Lekkertaal)

- TanStack Start + Cloudflare Workers + D1 + Drizzle stack. Server fns via `createServerFn({ method })`.
- Auth: `requireUserClerkId()` + `ensureUserRow()` at the top of any auth-gated server fn.
- Worker context: `requireWorkerContext()` to read `env.DB`, `env.TTS_CACHE`, etc.
- Drill types in seed use hyphens (`match-pairs`), DrillType union uses underscores (`match_pairs`). Normaliser lives in `src/lib/server/lesson.ts` → `normaliseDrillType`.
- Synthetic drills (no row in `exercises` table) carry `isSynthetic: true` so the lesson player skips `recordDrillResult`. See `buildFlashcardTail`.
- Per-pair tracking: `recordVocabPairResult({ nl, en, correct })` upserts misses into `spaced_rep_queue` under `itemType: "vocab_pair"`. Key is `<nl>|<en>` lowercased.
- Per-exercise tracking: `recordDrillResult({ exerciseId, correct, userAnswer })` upserts misses under `itemType: "exercise"`.
- Tests: vitest with `better-sqlite3` in-memory D1 harness at `src/lib/server/__tests__/test-db.ts`. `seedUser` defaults timezone to UTC so date-based tests don't fail at midnight CEST.
- Speaker component: `src/components/drills/Speaker.tsx`. Hits /api/tts which goes Wikimedia (single Dutch word) → OpenAI (everything else). ElevenLabs deprecated behind `ELEVENLABS_ENABLED="false"` flag.
- Lucide icons everywhere. NO emojis in user-facing UI. Shop item icons are the one remaining emoji surface (US-010 fixes that).
- Commit format: emoji + conventional. `✨ feat` / `🐛 fix` / `🧹 chore` / `📝 docs` / `🧪 test`. NO Co-Authored-By line.
- Weekday timestamps outside 08:30-18:00. After 18:00 or before 08:30, use real time. Otherwise stagger 5min after last commit.
- PR flow: branch → push → PR auto-opens CI → wait for green → squash-merge via `gh api PUT repos/RonanCodes/lekkertaal/pulls/<n>/merge -f merge_method=squash`. NEVER `git push origin main`. NEVER `gh pr merge --admin`.
- Auth gate: `throw redirect({ to: '/sign-in' })` from @tanstack/react-router. NEVER `throw new Error("Not signed in")`.
- Husky pre-push hook runs typecheck + lint + tests. Local CI is the trust signal; GH Actions runs the same gauntlet post-push but waiting for it is optional per the lekkertaal swarm lesson.

