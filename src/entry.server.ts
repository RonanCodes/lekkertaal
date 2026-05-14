/**
 * Custom server entry for Cloudflare Workers.
 *
 * The CF runtime invokes `fetch(request, env, ctx)`. TanStack Start's default
 * entry only forwards `request`, so to use D1 / R2 / vars from inside a route
 * handler we need to capture `env` and `ctx` at the boundary, stash them via
 * AsyncLocalStorage (now in `src/lib/server/worker-context.ts`), then read
 * them inside any handler that needs a binding.
 *
 * History:
 *
 *   - PR #95 added a top-level await + dynamic `cloudflare:workers` import
 *     here to seed the dev env fallback for Vite-SSR route loaders. That
 *     changed the bundle topology and dragged `node:async_hooks` (via
 *     AsyncLocalStorage) into the CLIENT bundle for `.tsx` route files that
 *     imported `requireWorkerContext` from this module. Result: /sign-in and
 *     /sign-up failed because Clerk's client component crashed at hydration.
 *
 *   - Issue #99 fixed this by moving the AsyncLocalStorage + the dev env
 *     bootstrap into `src/lib/server/worker-context.ts`, marked
 *     `'@tanstack/react-start/server-only'` so the import-protection plugin
 *     hard-blocks any client module from reaching it. The bootstrap is now
 *     LAZY (first call to `getWorkerContext()`) rather than top-level await,
 *     so this module has no module-init side effects that change bundle
 *     topology.
 *
 * This file now only contains the worker `fetch` and `scheduled` entry
 * points plus re-exports of the public worker-context surface for backward
 * compatibility with existing `import { requireWorkerContext } from
 * "../entry.server"` call sites.
 */
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import type { ExecutionContext } from "@cloudflare/workers-types";

// Register the TanStack Start instance with clerkMiddleware as a side effect.
// Must be imported before createStartHandler so the middleware is in the
// global request chain and Clerk's auth() helper works in route handlers.
import "./start";
import { db } from "./db/client";
import { resetStaleStreaks } from "./lib/server/gamification";
import { runDailyPushCron } from "./lib/server/cron-push";
import { runWeeklyDigestCron, runStreakRecoveryCron } from "./lib/server/email";
import { runDailyQuestsCron } from "./lib/server/daily-quests";
import { runWeeklyLeagueRoll } from "./lib/server/leagues";
import { configureLogger, withRequestLogContext } from "./lib/logger.server";
import { log } from "./lib/logger";
import { setDevEnvFallback, runInRequestScope } from "./lib/server/worker-context";
import type { WorkerEnv } from "./lib/server/worker-context";

// Re-export the public worker-context surface so existing call sites that
// import these from `entry.server` keep working.
export { getWorkerContext, requireWorkerContext } from "./lib/server/worker-context";
export type { WorkerEnv } from "./lib/server/worker-context";

const baseFetch = createStartHandler(defaultStreamHandler);

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    setDevEnvFallback(env, ctx);
    configureLogger({ env });
    return await runInRequestScope(env, ctx, async () => {
      return await withRequestLogContext(request, async () => {
        log.debug("request received", { method: request.method, url: request.url });
        return await baseFetch(request);
      });
    });
  },

  async scheduled(_event: unknown, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    // Cron handler. The 0 * * * * trigger runs hourly. Story-specific
    // schedulers register here, each is wrapped so a single failure doesn't
    // skip the rest.
    configureLogger({ env });
    await runInRequestScope(env, ctx, async () => {
      // US-020: reset stale streaks (consume freezes when available).
      try {
        const reset = await resetStaleStreaks(db(env.DB));
        if (reset > 0) {
          log.info("cron: streaks reset", { count: reset });
        }
      } catch (err) {
        log.error("cron: resetStaleStreaks failed", { err });
      }
      // US-027: daily-nag web push (matches reminder_hour to current UTC hour).
      try {
        const r = await runDailyPushCron(db(env.DB), env);
        if (r.targeted > 0) {
          log.info("cron: daily push", { targeted: r.targeted, sent: r.sent });
        }
      } catch (err) {
        log.error("cron: runDailyPushCron failed", { err });
      }
      // US-028: weekly digest (Sun 10:00 UTC, gated inside the fn).
      try {
        const r = await runWeeklyDigestCron(db(env.DB), env);
        if (r.sent > 0) log.info("cron: weekly digest", { sent: r.sent });
      } catch (err) {
        log.error("cron: runWeeklyDigestCron failed", { err });
      }
      // US-028: streak recovery (daily, idempotent via notification_log).
      try {
        const r = await runStreakRecoveryCron(db(env.DB), env);
        if (r.sent > 0) log.info("cron: streak recovery", { sent: r.sent });
      } catch (err) {
        log.error("cron: runStreakRecoveryCron failed", { err });
      }
      // P2-CON-3: seed today's daily quests for every user. Idempotent,
      // the per-user helper short-circuits when rows for the user's local
      // date already exist. Runs hourly so users in any tz get rows within
      // the first hour past their local midnight.
      try {
        const r = await runDailyQuestsCron(db(env.DB));
        if (r.seeded > 0) {
          log.info("cron: daily quests seeded", { seeded: r.seeded, scanned: r.scanned });
        }
      } catch (err) {
        log.error("cron: runDailyQuestsCron failed", { err });
      }
      // P2-ENG-1: weekly league roll. The CF Workers cron fires hourly, we
      // gate to "Monday between 00:00 and 01:00 UTC" so the roll runs once
      // per week. Idempotent via the unique (userId, weekStartDate) index,
      // so a duplicate tick is a no-op. Also gated below 30 active users.
      try {
        const now = new Date();
        const isMonday = now.getUTCDay() === 1;
        const hour = now.getUTCHours();
        if (isMonday && hour === 0) {
          const r = await runWeeklyLeagueRoll(db(env.DB), { now });
          if (!r.ran) {
            log.info("leagues skipped, threshold not met", { activeUsers: r.activeUsers });
          } else {
            log.info("cron: weekly league roll", {
              activeUsers: r.activeUsers,
              closed: r.closed,
              opened: r.opened,
            });
          }
        }
      } catch (err) {
        log.error("cron: runWeeklyLeagueRoll failed", { err });
      }
    });
  },
};
