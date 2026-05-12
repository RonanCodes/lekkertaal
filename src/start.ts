/**
 * TanStack Start instance registration.
 *
 * NOTE 2026-05-13: clerkMiddleware() integration was attempted here but
 * caused 500s on cold-start. Reverted. The right wiring needs Clerk env
 * keys threaded in at request time from the Worker env (process.env is
 * empty on CF Workers).
 *
 * Currently empty so `import "./start"` is safe. Re-add the createStart
 * call once we have a Cloudflare-aware Clerk middleware pattern.
 */
export {};
