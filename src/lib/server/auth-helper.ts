/**
 * Server-side auth helper.
 *
 * `requireUserClerkId()` wraps Clerk's `auth()` and adds two opt-in bypass
 * branches so dev and e2e workflows can navigate `/app/*` routes without
 * going through Clerk's hosted UI.
 *
 * Bypass branches (both require `import.meta.env.DEV === true`):
 *
 *   1. Local dev bypass: `env.DEV_BYPASS_AUTH === "true"` in `.dev.vars`.
 *      Activated by `pnpm dev:bypass-auth`. Returns `DEV_BYPASS_CLERK_ID`.
 *
 *   2. E2E header bypass: request header `x-lekkertaal-e2e-bypass` matches
 *      `env.E2E_BYPASS_TOKEN`. Used by playwright signed-in specs to skip
 *      the Clerk dev-instance dev-browser handshake (which is unreliable
 *      in headless Chromium). Returns `DEV_BYPASS_CLERK_ID`.
 *
 * Both branches are gated on `import.meta.env.DEV`. Vite statically replaces
 * that with `false` in the production worker bundle, so neither branch can
 * fire in production code, they are dead-code-eliminated at build time.
 * Even if `E2E_BYPASS_TOKEN` is accidentally set as a wrangler secret, the
 * branch is unreachable in the deployed worker.
 *
 * Otherwise: delegate to `auth()` and throw `redirect({ to: '/sign-in' })`
 * if not authenticated. This is the production code path.
 */
import { redirect } from "@tanstack/react-router";
import { auth } from "@clerk/tanstack-react-start/server";
import { getRequestHeader } from "@tanstack/react-start/server";
import { getWorkerContext } from "../../entry.server";

/** Fixed clerk-id used by the dev / e2e bypass. Matches `seed_ronan` in seed/users.json. */
export const DEV_BYPASS_CLERK_ID = "seed_ronan";

/** Request header the playwright e2e suite uses to opt into the bypass. */
export const E2E_BYPASS_HEADER = "x-lekkertaal-e2e-bypass";

/**
 * Resolve the current user's Clerk id, or `null` if not authenticated.
 *
 * Non-throwing variant of `requireUserClerkId`. Same dev/e2e bypass logic;
 * returns `null` instead of throwing a redirect when there is no session.
 * Use this for loaders that want to *probe* auth state without forcing a
 * redirect (e.g. the public landing route deciding whether to auto-forward
 * an already-signed-in user to `/app/path`).
 */
export async function tryGetUserClerkId(): Promise<string | null> {
  if (import.meta.env.DEV) {
    const ctx = getWorkerContext();
    const fromCtx = ctx?.env.DEV_BYPASS_AUTH === "true";
    const fromProcEnv = typeof process !== "undefined" && process.env?.DEV_BYPASS_AUTH === "true";
    if (fromCtx || fromProcEnv) {
      return DEV_BYPASS_CLERK_ID;
    }
    // E2E header bypass. Requires a shared secret; a leaked URL alone is
    // not sufficient to grant access.
    const expectedToken =
      ctx?.env.E2E_BYPASS_TOKEN ??
      (typeof process !== "undefined" ? process.env?.E2E_BYPASS_TOKEN : undefined);
    if (expectedToken) {
      let headerValue: string | undefined;
      try {
        headerValue = getRequestHeader(E2E_BYPASS_HEADER);
      } catch {
        // Outside a request scope (e.g. unit tests without the helper mocked).
        headerValue = undefined;
      }
      if (headerValue && headerValue === expectedToken) {
        return DEV_BYPASS_CLERK_ID;
      }
    }
  }
  const a = await auth();
  return a.userId ?? null;
}

/**
 * Resolve the current user's Clerk id, or throw a redirect to `/sign-in`.
 *
 * In Vite dev mode (only), two shortcuts are honoured:
 *   - `DEV_BYPASS_AUTH=true` in `.dev.vars` returns the seed user id.
 *   - `x-lekkertaal-e2e-bypass: <E2E_BYPASS_TOKEN>` header returns the seed
 *     user id (e2e playwright path).
 *
 * In every other build (prod worker, preview, prod build of dev) the dev
 * branch is dead-code-eliminated and `auth()` is called.
 */
export async function requireUserClerkId(): Promise<string> {
  const id = await tryGetUserClerkId();
  if (!id) throw redirect({ to: "/sign-in" });
  return id;
}
