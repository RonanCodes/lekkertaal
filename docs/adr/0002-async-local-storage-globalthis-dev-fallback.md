# 0002 — AsyncLocalStorage with `globalThis` fallback in dev mode

**Status:** Accepted (dev half extended by [ADR 0007](./0007-vite-dev-env-bootstrap.md))
**Date:** 2026-05-14

## Context

Server functions need access to the Cloudflare Worker `env` (bindings, secrets) without threading it through every call site. The standard pattern is an AsyncLocalStorage store opened in `fetch()` and read by helpers like `requireWorkerContext()`.

In production this works. In Vite dev, TanStack Start's server-fn RPC layer breaks the AsyncLocalStorage scope: by the time the server function runs, the store is empty and `requireWorkerContext()` throws `Worker context not available`. This is a known TanStack Start v6 limitation around the dev-only RPC bridge.

## Decision

Keep AsyncLocalStorage as the production pattern. For dev mode only, add a `globalThis` fallback so the `env` survives the RPC hop.

- `setDevEnvFallback(env)` — called once per request in dev, sets `globalThis.__lekkertaalDevEnv__`
- `readDevEnvFallback()` — called inside `requireWorkerContext()` when the ALS store is missing; throws in production
- The fallback is gated on `import.meta.env.DEV` so it cannot ship to production bundles

## Consequences

- Dev parity with prod is imperfect: a single global is shared across concurrent dev requests. Acceptable because dev is single-tenant (one user, one tab).
- If we ever hit a TanStack Start version that fixes RPC scope propagation, delete the fallback and the prod path is unchanged.
- The dev fallback is documented in `src/entry.server.ts` next to the AsyncLocalStorage definition.

## Related

- `src/entry.server.ts` for `requireWorkerContext` + `setDevEnvFallback` + `readDevEnvFallback`
- `src/lib/server/auth-helper.ts` for the canonical consumer
- TanStack Start v6 RPC bridge is the underlying constraint
- [ADR 0007](./0007-vite-dev-env-bootstrap.md) extends this with an
  eager `wrangler.getPlatformProxy` bootstrap so the fallback is populated
  even for Vite-SSR route loaders that bypass the worker fetch path.
