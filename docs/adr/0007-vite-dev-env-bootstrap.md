# 0007 — Bootstrap a dev env fallback via `cloudflare:workers`

**Status:** Accepted
**Date:** 2026-05-14
**Supersedes the dev half of:** [0002](./0002-async-local-storage-globalthis-dev-fallback.md)

## Context

ADR 0002 added an `AsyncLocalStorage` + `globalThis` fallback for the
Cloudflare Worker `env` so `requireWorkerContext()` could read D1, R2 and
secrets inside route handlers. The pattern relied on `entry.server.fetch`
running for every request, since that's where `setDevEnvFallback(env, ctx)`
is invoked.

That assumption broke for **route loaders in Vite dev mode**. TanStack Start
v6 executes route loaders through Vite's SSR module graph, not through the
`@cloudflare/vite-plugin` worker fetch path. So a request to `/app/path`
calls a route loader that calls `requireWorkerContext()`, but the loader
never traversed `entry.server.fetch`. The AsyncLocalStorage store is empty,
the globalThis fallback was never written, and the call throws
`Worker context not available`.

Tracked as issue [#90](https://github.com/RonanCodes/lekkertaal/issues/90).
The signed-in e2e suite (11 specs) and any local `pnpm dev` traffic to
`/app/*` route loaders all 500 on this.

## Decision

Eagerly bootstrap the dev env fallback at `entry.server.ts` module-load
time, by importing `env` from `cloudflare:workers`.

When `@cloudflare/vite-plugin` runs our entry inside its workerd
runner-worker, it patches the `cloudflare:workers` module so that
`import { env } from "cloudflare:workers"` resolves to the same CF env
the deployed worker would receive (D1, R2, vars, secrets from
`.dev.vars`). Reading it at module init populates the globalThis fallback
without needing to go through `entry.server.fetch`.

- Bootstrap is gated on `import.meta.env.DEV`. The whole branch is
  dead-code-eliminated in the production worker bundle, so the dynamic
  import is never traversed in prod.
- The bootstrap uses **top-level await** so any importer of
  `entry.server.ts` sees a populated `globalThis.__lekkertaal_dev_env__`
  by the time their code runs. Route loaders import the helpers via
  `auth-helper.ts` → `entry.server`, so the await chain is correct.
- Process-env values (notably `DEV_BYPASS_AUTH` set by
  `scripts/dev-bypass-auth.sh`) layer over the workerd env so shell-set
  overrides win.
- `setDevEnvFallback` still fires inside `entry.server.fetch` for explicit
  `/api/*` routes that do go through the worker fetch path. That overwrite
  is harmless and keeps the AsyncLocalStorage path as the prod source of
  truth.
- If the dynamic import fails (e.g. in vitest where the module isn't
  patched), the bootstrap is a silent no-op and the AsyncLocalStorage
  path still applies. Vitest already mocks `entry.server` for the small
  number of unit tests that touch it.

A no-op `ExecutionContext` stub is synthesized for the bootstrap path.
Route loaders rarely call `ctx.waitUntil` / `ctx.passThroughOnException`;
if a consumer ever needs real ctx semantics in dev it must branch on
`import.meta.env.DEV` and skip the call.

## Consequences

- Dev parity with prod is closer than before: route loaders see the same
  bindings the deployed worker sees, sourced from `wrangler.jsonc` +
  `.dev.vars`.
- Bootstrap is one synchronous module-init call against an already-loaded
  `cloudflare:workers` module: cost is negligible.
- No new dev dependency. The fallback uses the same `cloudflare:workers`
  module the rest of the worker uses.
- ADR 0002's `globalThis` fallback is still in place for the
  AsyncLocalStorage-loss case during dev server-fn RPC. This ADR adds the
  bootstrap; it does not replace 0002.

## Alternatives considered

- **Option A from #90: align `wrangler.jsonc` `main` to `src/entry.server.ts`.**
  Risked breaking the production build, which uses TanStack Start's
  bundler with `@tanstack/react-start/server-entry`. Not worth the risk.
- **Option C from #90: a `@cloudflare/vite-plugin` "wrap worker entry" hook.**
  The plugin (v1.36) does not expose such a hook. Filed mentally for a
  future revisit if the plugin gains one.

## Related

- `src/entry.server.ts` — bootstrap implementation and consumer surface
- `scripts/dev-bypass-auth.sh` — sets `DEV_BYPASS_AUTH` in `.dev.vars` and
  exports it; the bootstrap reads both
- [ADR 0002](./0002-async-local-storage-globalthis-dev-fallback.md) — the
  AsyncLocalStorage + globalThis fallback this builds on
- [issue #90](https://github.com/RonanCodes/lekkertaal/issues/90) — the
  bug this resolves
