# Production deploy — lekkertaal.ronanconnolly.dev

## Continuous delivery

Every push to `main` triggers `.github/workflows/deploy.yml`:

1. Build job runs on the PR + on main.
2. Deploy job (main only) installs deps, builds, applies all
   `drizzle/*.sql` migrations to the production D1 (`lekkertaal_db`),
   then runs `wrangler deploy`.

The latest deploy at the time of writing this doc:

- `/` returns HTTP 200, ~5 KB of HTML.
- `/app/path` returns HTTP 307 → `/sign-in` (BUG-002 fix is live).
- `/manifest.json` returns HTTP 200 with `application/json`.
- `/sw.js` returns HTTP 200 with `text/javascript`.

## Configured bindings (wrangler.jsonc)

- D1 `DB` → `lekkertaal_db` (`ca05c5b2-512c-4007-88a6-b2499e4cbd12`)
- R2 `TTS_CACHE` → `lekkertaal-tts`
- Custom domain `lekkertaal.ronanconnolly.dev`
- Cron `0 * * * *` (hourly)

## Required secrets

Push each via `wrangler secret put <NAME>`. Crons + handlers no-op
cleanly when an optional secret is missing.

| Secret | Required? | Used by |
|---|---|---|
| `CLERK_SECRET_KEY` | yes | Clerk auth |
| `VITE_CLERK_PUBLISHABLE_KEY` | yes | Client SDK |
| `CLERK_WEBHOOK_SECRET` | yes | `/api/clerk-webhook` |
| `ANTHROPIC_API_KEY` | yes | roleplay chat + grader |
| `OPENAI_API_KEY` | optional | TTS fallback |
| `GOOGLE_GENERATIVE_AI_API_KEY` | optional | future Gemini fallback |
| `ELEVENLABS_API_KEY` | optional | primary TTS provider |
| `RESEND_API_KEY` | optional | weekly digest + recovery email |
| `VAPID_PUBLIC` | optional | web push (cron-push) |
| `VAPID_PRIVATE` | optional | web push (cron-push) |
| `VAPID_SUBJECT` | optional | web push (`mailto:` or https URL) |
| `SENTRY_DSN` | optional | error reporting |
| `POSTHOG_PROJECT_KEY` | optional | analytics |

The deploy workflow runs in the `production` environment so CF account
credentials (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) are pulled
from repository secrets, not committed.

## DNS

`lekkertaal.ronanconnolly.dev` is configured as a custom domain on the
Worker via the `routes` block in `wrangler.jsonc`. Cloudflare manages
the orange-cloud proxy automatically.

## Smoke checklist (post-deploy)

```
curl -sI https://lekkertaal.ronanconnolly.dev/ | head -1
curl -sI -o/dev/null -w "%{http_code}\n" https://lekkertaal.ronanconnolly.dev/app/path
curl -s https://lekkertaal.ronanconnolly.dev/manifest.json | jq .name
curl -sI -o/dev/null -w "%{http_code}\n" https://lekkertaal.ronanconnolly.dev/sw.js
```

Expected: 200, 307, "Lekkertaal", 200.
