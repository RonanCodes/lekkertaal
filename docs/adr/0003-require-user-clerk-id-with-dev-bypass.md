# 0003 — `requireUserClerkId()` with `DEV_BYPASS_AUTH` shortcut

**Status:** Accepted
**Date:** 2026-05-14

## Context

Every server function that touches user data needs to know which Clerk-authenticated user is making the call. We want a single helper that:

1. Reads the Clerk session from the request,
2. Throws a redirect to `/sign-in` if the user is not signed in,
3. Returns the Clerk user ID otherwise.

We also need a fast path for local dev: typing Clerk credentials every cold start is friction we don't want.

## Decision

Single helper at `src/lib/server/auth-helper.ts`:

```ts
export async function requireUserClerkId(): Promise<string> {
  if (env.DEV_BYPASS_AUTH === "true") return "seed_ronan";
  const auth = await getAuth();
  if (!auth.userId) throw redirect({ to: "/sign-in" });
  return auth.userId;
}
```

- `DEV_BYPASS_AUTH=true` is read from `.dev.vars` only (NEVER from `wrangler.jsonc` vars), so it can never ship to production.
- The bypass returns the seed user `seed_ronan` (one of 4 demo users from `seed:users`).
- Companion script: `pnpm dev:bypass-auth` toggles `DEV_BYPASS_AUTH=true` in `.dev.vars` for the session and restores on exit.

## Consequences

- Adding a new server function = one line: `const userId = await requireUserClerkId();`. No middleware glue.
- The bypass is a real backdoor — guard against it leaking into prod by code-search before each deploy. Pre-flight gate in `/ro:cf-ship` greps for `DEV_BYPASS_AUTH` in compiled output.
- If we ever need multiple dev personas, extend the bypass to `DEV_BYPASS_AUTH=<clerkId>` and resolve from the seed user table.

## Related

- `src/lib/server/auth-helper.ts` for the implementation
- `scripts/dev-bypass-auth.sh` for the session toggle
- ADR [0002](./0002-async-local-storage-globalthis-dev-fallback.md) for why `env` is reachable from this helper at all
