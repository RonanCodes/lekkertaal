/**
 * TanStack Start instance registration.
 *
 * MUST export `startInstance` — TanStack Start's hydrate code imports it from
 * `#tanstack-start-entry` which resolves to this file. Removing the export
 * breaks the production build.
 *
 * NOTE 2026-05-13: clerkMiddleware() integration was attempted here but
 * caused 500s on cold-start (Clerk env keys not visible at module init time
 * on Cloudflare Workers; `process.env` is empty, keys arrive on the per-request
 * env argument). Until a CF-aware Clerk middleware pattern is in place, this
 * is a bare startInstance with no middleware.
 *
 * Follow-up: re-add `clerkMiddleware(callback)` with a callback that defers
 * key reads to request time via the env binding.
 */
import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({}));
