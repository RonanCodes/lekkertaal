# 0008: Server-only worker context module

**Status:** Accepted
**Date:** 2026-05-14
**Revises:** [0007](./0007-vite-dev-env-bootstrap.md)

## Context

ADR 0007 added a top-level `await` + dynamic `import("cloudflare:workers")`
to `src/entry.server.ts` to seed the dev env fallback for Vite-SSR route
loaders. That fix solved the original `/app/*` 500s on route-loader-only
requests but introduced a regression: the top-level await changed the bundle
topology, and Vite started pulling `entry.server.ts` into the CLIENT graph
for some `.tsx` route files (notably `app.profile.tsx`, `app.settings.tsx`,
`app.peer.tsx`, `app.users.tsx`, `app.profile.$displayName.tsx`) that
imported `requireWorkerContext` from this module.

The user-visible failure: hitting `/sign-up` (or `/sign-in`) in a real
browser produced

```
Module "node:async_hooks" has been externalized for browser compatibility.
Cannot access "node:async_hooks.AsyncLocalStorage" in client code.
```

and Clerk's `<SignUp/>` / `<SignIn/>` components failed to mount because
the bundle errored before hydration. Confirmed against `pnpm dev:bypass-auth`
on 2026-05-14. Tracked as [issue #99](https://github.com/RonanCodes/lekkertaal/issues/99).

A second AsyncLocalStorage import in `src/lib/logger.ts` (for per-request
debug-level overrides) was also reachable from the client graph via the
chain `LiveRubric.tsx -> lib/server/roleplay.ts -> lib/ai-telemetry.ts ->
logger.ts`. That chain pre-dated #95 but had been benign because the
bundler tree-shook the static `AsyncLocalStorage` reference. PR #95's
top-level await changed enough about the module's init shape that the
tree-shake no longer fired and both AsyncLocalStorage instances ended
up in the client chunk.

## Decision

Split the AsyncLocalStorage usage out of `entry.server.ts` and `logger.ts`
into two server-only modules, then make the dev env bootstrap lazy so it
does not require top-level await.

- `src/lib/server/worker-context.ts` (new) holds the `WorkerEnv` type, the
  `requestStore` AsyncLocalStorage, `getWorkerContext()`, `requireWorkerContext()`,
  `setDevEnvFallback()`, `runInRequestScope()`, and the dev bootstrap
  itself. The bootstrap is fired as a fire-and-forget side effect at module
  load (`void ensureDevEnvBootstrapped()`) so it completes by the time the
  first request hits a route loader, without changing bundle topology the
  way a top-level await would.
- `src/lib/logger.server.ts` (new) holds `configureLogger()`,
  `withRequestLogContext()`, and the `AsyncLocalStorage` that backs
  per-request `?debug=1` log-level overrides.
- `src/lib/logger.ts` is now a thin file that only exports `log`
  (a `getLogger(["lekkertaal"])` handle). No `node:async_hooks` import,
  safe to reach from any client chain.
- Both new server-only files start with `import "@tanstack/react-start/server-only"`.
  TanStack Start's import-protection plugin replaces this specifier with a
  virtual empty module and marks the importing file as server-only. Any
  client-graph module that transitively imports either file triggers a
  build-time violation, which means future leaks fail loudly instead of
  silently shipping `node:async_hooks` to the browser.
- `entry.server.ts` keeps its public API by re-exporting
  `getWorkerContext`, `requireWorkerContext`, and `WorkerEnv` from
  `lib/server/worker-context.ts`. The 35-odd call sites that
  `import { requireWorkerContext } from "../entry.server"` continue to work
  unchanged.

Verification (per acceptance criteria in #99):

- A headless Chromium probe against `/sign-up` reports **0 externalized
  module errors** and `window.Clerk === <Clerk instance>`. Same for `/sign-in`.
- `curl http://localhost:3004/app/path` with `DEV_BYPASS_AUTH=true` returns
  HTTP 200 with the seed-ronan AppShell rendered (streak counter, XP,
  Path nav). PR #95's acceptance criterion still holds.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` clean.
  All 281 unit tests pass.
- A grep of `dist/client/assets/*.js` for `AsyncLocalStorage`,
  `node:async_hooks`, or `node:perf_hooks` returns zero matches after the
  fix (previously 1 client chunk contained the `lekkertaal` logger plus
  its AsyncLocalStorage).

## Consequences

- The dev env binding fix from #95 still works. Route loaders that call
  `requireWorkerContext()` see a populated env on the first request and
  every subsequent request, sourced from `cloudflare:workers` and merged
  with `process.env`. Cron handlers (`scheduled()`) are unaffected, the
  AsyncLocalStorage path is the prod source of truth.
- The server-only marker is enforced by the import-protection plugin at
  build time. If a future contributor imports `worker-context.ts` from a
  client component, the build fails with a clear error pointing at the
  offending module, rather than shipping a broken bundle.
- `logger.ts` and `logger.server.ts` are a small additional split that
  keeps `log` reachable from anywhere while pinning configuration and
  request scoping to the server bundle.
- Module load-time `void ensureDevEnvBootstrapped()` is fire-and-forget,
  it does not block import. First-request route loaders see the populated
  globalThis fallback because the bootstrap promise resolves well before
  the request reaches them. If a future refactor needs a strict guarantee,
  the new exported `getWorkerContextAsync()` awaits the bootstrap promise
  explicitly.

## Alternatives considered

- **Option A in #99: rename `entry.server.ts` to a `.server.tsx` convention.**
  TanStack Start does not treat the `.server.ts` suffix as a hard boundary
  (only the `'@tanstack/react-start/server-only'` marker import does).
  Skipped, the marker import is the supported mechanism.
- **Option C in #99: guard `AsyncLocalStorage` imports with `typeof process`
  runtime checks.** Works but pollutes every consumer with branching and
  defeats Vite's static analysis. The split + marker is cleaner.
- **Keep the top-level await but tree-shake harder.** Not feasible inside
  Vite's current module-graph behaviour, and the symptom would inevitably
  resurface as the route surface grows.

## Related

- `src/lib/server/worker-context.ts`, new server-only module
- `src/lib/logger.server.ts`, new server-only module
- `src/lib/logger.ts`, thinned to just `export const log`
- `src/entry.server.ts`, re-exports the worker-context surface; no more
  inline AsyncLocalStorage or top-level await
- [ADR 0007](./0007-vite-dev-env-bootstrap.md), the original dev env
  bootstrap (still in effect, just relocated)
- [ADR 0002](./0002-async-local-storage-globalthis-dev-fallback.md),
  the AsyncLocalStorage + globalThis fallback pattern
- [issue #99](https://github.com/RonanCodes/lekkertaal/issues/99), the
  bug this resolves
