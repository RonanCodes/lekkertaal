/**
 * Server-side auth helper.
 *
 * `requireUserClerkId()` wraps Clerk's `auth()` and adds an opt-in localhost
 * dev bypass so the dev/test workflow can navigate `/app/*` routes without
 * going through Clerk's hosted UI on every restart.
 *
 * Bypass rules (all must be true):
 *   1. `import.meta.env.DEV === true`  — Vite dev build, never the deployed
 *      worker bundle. The deployed prod worker is a production build where
 *      `import.meta.env.DEV` is statically replaced with `false`, so the
 *      bypass branch is dead-code-eliminated and CANNOT fire in production.
 *   2. `env.DEV_BYPASS_AUTH === "true"` — explicit opt-in flag in `.dev.vars`.
 *      Never set in `wrangler.jsonc` vars (production safety).
 *
 * When both are true, the helper returns the fixed clerk-id placeholder
 * `seed_ronan`, which matches the seed user emitted by `scripts/seed-users.ts`
 * for the "Ronan" display name. Run `pnpm seed:users` once locally before
 * relying on the bypass so the row exists in the local D1.
 *
 * Otherwise: delegate to `auth()` and throw `redirect({ to: '/sign-in' })`
 * if not authenticated. This is the production code path.
 */
import { redirect } from "@tanstack/react-router";
import { auth } from "@clerk/tanstack-react-start/server";
import { getWorkerContext } from "../../entry.server";

/** Fixed clerk-id used by the dev bypass. Matches `seed_ronan` in seed/users.json. */
export const DEV_BYPASS_CLERK_ID = "seed_ronan";

/**
 * Resolve the current user's Clerk id, or throw a redirect to `/sign-in`.
 *
 * In Vite dev mode with `DEV_BYPASS_AUTH=true`, returns a fixed seed-user id
 * without calling Clerk. In every other build (prod worker, preview, prod
 * build of dev) calls real `auth()`.
 */
export async function requireUserClerkId(): Promise<string> {
  if (import.meta.env.DEV) {
    const ctx = getWorkerContext();
    const fromCtx = ctx?.env.DEV_BYPASS_AUTH === "true";
    const fromProcEnv = typeof process !== "undefined" && process.env?.DEV_BYPASS_AUTH === "true";
    if (fromCtx || fromProcEnv) {
      return DEV_BYPASS_CLERK_ID;
    }
  }
  const a = await auth();
  if (!a.userId) throw redirect({ to: "/sign-in" });
  return a.userId;
}
