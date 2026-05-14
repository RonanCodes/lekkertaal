/**
 * Logger built on Logtape. Two sinks:
 *
 *   - `console`, always on. Structured JSON to stdout, which becomes the
 *                Vite terminal locally + `wrangler tail` in prod.
 *   - `sentry`,  enabled when SENTRY_DSN is set. `@logtape/sentry`'s
 *                `getSentrySink()` forwards records to the global Sentry
 *                instance, and `enableBreadcrumbs` turns info+ records into
 *                Sentry breadcrumbs so error reports carry the trail.
 *
 * Level rules (lowest-permits to highest-only):
 *
 *   trace < debug < info < warning < error < fatal
 *
 *   - Default minimum: `info`
 *   - Override globally via env `LOG_LEVEL=debug|info|warning|error|fatal`
 *   - Override per-request via `?debug=1` (or `x-lekkertaal-debug: 1` header).
 *     Wrap the request handler with `withRequestLogContext(request, fn)` from
 *     `./logger.server.ts`. AsyncLocalStorage carries the effective minimum
 *     level per-request and lives in the server-only module so it never
 *     leaks `node:async_hooks` into the client bundle (issue #99).
 *
 * Configure ONCE per worker boot via `configureLogger({ env })` from
 * `entry.server.ts` (re-exported from `./logger.server.ts`). Subsequent
 * calls are idempotent and cheap.
 *
 * Usage:
 *
 *   import { log } from '#/lib/logger'
 *   log.info('user signed in', { userId, plan: 'free' })
 *   log.debug('drill graded', { drillId, ok, attempts })
 *   log.error('TTS fetch failed', { text, voiceId, status, err })
 *
 * `log` is safe to import from any file (server or client), the
 * `getLogger()` call here does not pull in `node:async_hooks`. The
 * AsyncLocalStorage and `configureLogger` / `withRequestLogContext` helpers
 * live in `./logger.server.ts` behind a TanStack Start server-only marker.
 */
import { getLogger } from "@logtape/logtape";

/** Root logger for app code. Children: log.getChild('roleplay') etc. */
export const log = getLogger(["lekkertaal"]);
