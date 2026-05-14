# 0004 — Runtime config injection over `VITE_*` env vars

**Status:** Proposed
**Date:** 2026-05-14

## Context

Observability keys (Sentry DSN, PostHog project key) need to reach the client bundle. The default Vite pattern is `VITE_SENTRY_DSN` baked at build time.

Two problems with that:

1. **Forks ship our keys.** Anyone who clones and builds gets a bundle with our DSN baked in.
2. **Rotation requires a rebuild.** Rotating a leaked key means CI rebuild + redeploy before the change takes effect.

## Decision (proposed)

Move client-visible observability config to runtime:

- `wrangler.jsonc` → `vars: { SENTRY_DSN: "", POSTHOG_PROJECT_KEY: "", POSTHOG_INGEST_HOST: "https://eu.i.posthog.com" }`
- `src/routes/api/config.ts` → GET returns `{ sentryDsn, posthogKey, posthogHost }` from `env`
- `src/lib/runtime-config.ts` → memoised client-side `fetch('/api/config')`
- `initSentry()` / `initPostHog()` are **async**, read from runtime-config, no-op if keys are empty

Currently lekkertaal uses neither Sentry-DSN-in-bundle nor PostHog-key-in-bundle (logtape ships to Sentry server-side only; PostHog is unwired). When we wire client-side telemetry, this ADR is the pattern.

## Consequences

- Keys rotate without rebuilds.
- CI can build without observability secrets.
- One extra fetch before analytics init: fine because analytics are not critical path.
- Forks don't ship our keys.
- Cost: a tiny boilerplate fetch + null-guard at startup.

## Related

- [`/ro:new-tanstack-app`](https://github.com/RonanCodes/ronan-skills/tree/main/skills/new-tanstack-app) scaffold step 8-9 already implements this pattern for new apps
- Future PR will retrofit lekkertaal when Sentry/PostHog client SDKs land
