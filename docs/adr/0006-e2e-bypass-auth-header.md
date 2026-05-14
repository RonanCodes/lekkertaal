# 0006: E2E auth bypass via shared-secret header

**Status:** Accepted
**Date:** 2026-05-14

## Context

`pnpm test:e2e` signed-in specs (`e2e/auth/*.spec.ts`) cannot sign in against the deployed `lekkertaal.ronanconnolly.dev` even with `@clerk/testing` wired correctly. Root cause (issue #93): the deployed worker uses a `pk_test_` publishable key, which requires a `__dev_browser` cookie set via an OAuth-style handshake with `accounts.dev` on the first real-browser visit. Headless Chromium does not reliably complete that handshake, so `clerk.signIn` times out on `window.Clerk.loaded`.

Three options were on the table (see #93):

- A. Provision a Clerk production instance (`pk_live_`). Canonical, but pulls in production-instance pricing posture and a one-way config change.
- B. Pre-set the dev-browser cookie via a Playwright fixture. Brittle, depends on Clerk's internal handshake shape.
- C. Reuse the existing `DEV_BYPASS_AUTH` shape (ADR 0003) and extend it with a Playwright-accessible header.

We picked C because (1) the dev-bypass machinery already exists, (2) the bypass is gated by `import.meta.env.DEV`, so the production worker bundle has the branch dead-code-eliminated, and (3) e2e parity between local and deployed runs is more important than canonical Clerk integration for a single-developer side project.

## Decision

Extend `requireUserClerkId()` with a second bypass branch alongside the existing `DEV_BYPASS_AUTH` shortcut. Both branches share the same `import.meta.env.DEV` gate.

```ts
// src/lib/server/auth-helper.ts
if (import.meta.env.DEV) {
  // (1) DEV_BYPASS_AUTH path from ADR 0003
  if (env.DEV_BYPASS_AUTH === "true") return DEV_BYPASS_CLERK_ID;

  // (2) E2E header bypass (this ADR)
  const expected = env.E2E_BYPASS_TOKEN;
  const header = getRequestHeader("x-lekkertaal-e2e-bypass");
  if (expected && header && header === expected) return DEV_BYPASS_CLERK_ID;
}
// ...real auth
```

Shape:

- `E2E_BYPASS_TOKEN` is a 64-char hex shared secret, generated via `openssl rand -hex 32`.
- Local: lives in `.dev.vars` (gitignored). Template in `.dev.vars.example`.
- Deployed: set as a wrangler secret via `wrangler secret put E2E_BYPASS_TOKEN`.
- Playwright sets the header on the BrowserContext via `page.context().setExtraHTTPHeaders({ "x-lekkertaal-e2e-bypass": process.env.E2E_BYPASS_TOKEN })`.
- The helper returns the fixed seed user `seed_ronan` (same as ADR 0003), which is loaded into prod D1 by the seed-load workflow (PR #88).

### Why this is safe in production

`import.meta.env.DEV` is a Vite compile-time constant. In a `vite build` production bundle, Vite replaces it with the literal `false`. The whole `if (import.meta.env.DEV) { ... }` block is then unreachable code and gets dropped by minification. The runtime cannot enter the bypass branch even if `E2E_BYPASS_TOKEN` is somehow set as a worker secret.

The header itself only grants access in dev / preview builds. To run signed-in e2e against the live worker, we either:

1. Accept the bypass is dev-only and run signed-in e2e against `pnpm dev:bypass-auth` (preferred for CI),
2. Or deploy a preview build with `import.meta.env.DEV` still active for staging-only e2e runs.

Defence in depth: the bypass also requires a matching shared secret. A leaked endpoint URL alone cannot grant access.

## Consequences

- `e2e/setup/clerk-auth.ts` swaps from `@clerk/testing` ticket sign-in to a single `signInViaBypass(page)` call. Drops the 30-second Clerk SDK boot wait.
- The legacy `signInAsTestUser` name is kept as a deprecated alias so the 4 existing spec files compile without diff.
- New env var: `E2E_BYPASS_TOKEN`. Documented in `.dev.vars.example`.
- The 11 signed-in specs in `e2e/auth/*` now run against any environment where the token is configured on both client and server.
- Adds a second bypass surface to keep secure: any future audit of "where can auth be skipped" needs to check both `DEV_BYPASS_AUTH` and `E2E_BYPASS_TOKEN`. Both are gated by the same `import.meta.env.DEV` boundary.

## Alternatives considered

- **A. `pk_live_` Clerk instance.** Right answer eventually. Punted because lekkertaal is at zero MAU and we do not want to manage a second Clerk instance + redirect URLs + webhooks for what is currently a personal side project.
- **B. Cookie pre-seeding.** Coupled to Clerk internals; would break silently when Clerk rotates the handshake.
- **Test-only login route.** Adds a new public endpoint to the worker that has to be carefully gated. The header-on-existing-routes approach has a smaller attack surface.

## Related

- ADR [0003](./0003-require-user-clerk-id-with-dev-bypass.md) for the `DEV_BYPASS_AUTH` precedent that this extends.
- Issue [#93](https://github.com/RonanCodes/lekkertaal/issues/93) for the bug report and acceptance criteria.
- PR #89 for the `DEV_BYPASS_AUTH` process.env fallback.
- PR #92 for the prior `@clerk/testing` attempt.
