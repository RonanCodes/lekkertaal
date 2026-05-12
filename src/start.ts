/**
 * TanStack Start instance.
 *
 * Wires clerkMiddleware() into the global request chain so that `auth()`
 * from `@clerk/tanstack-react-start/server` resolves the session inside
 * any server function or route handler.
 *
 * Why this works on Cloudflare Workers:
 *   - `CLERK_PUBLISHABLE_KEY` lives in wrangler.jsonc `vars` (public — Clerk
 *     designed publishable keys to ship to browsers), so it's available
 *     at module init time when createStart runs.
 *   - `CLERK_SECRET_KEY` is a wrangler secret pushed via `wrangler secret put`,
 *     read by the Clerk SDK at request time via the env binding.
 *
 * Reference: https://clerk.com/docs/quickstarts/tanstack-react-start
 * Pattern source: dataforce production (src/start.ts).
 */
import { createStart } from "@tanstack/react-start";
import { clerkMiddleware } from "@clerk/tanstack-react-start/server";

export const startInstance = createStart(() => ({
  requestMiddleware: [clerkMiddleware()],
}));
