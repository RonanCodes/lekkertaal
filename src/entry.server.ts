/**
 * Custom server entry for Cloudflare Workers.
 *
 * The CF runtime invokes `fetch(request, env, ctx)`. TanStack Start's default
 * entry only forwards `request`, so to use D1 / R2 / vars from inside a route
 * handler we need to capture `env` and `ctx` at the boundary, stash them via
 * AsyncLocalStorage, then read them inside any handler that needs a binding.
 */
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import type { D1Database, R2Bucket, ExecutionContext } from "@cloudflare/workers-types";
import { AsyncLocalStorage } from "node:async_hooks";

// Register the TanStack Start instance with clerkMiddleware as a side effect.
// Must be imported before createStartHandler so the middleware is in the
// global request chain and Clerk's auth() helper works in route handlers.
import "./start";
import { db } from "./db/client";
import { resetStaleStreaks } from "./lib/server/gamification";
import { runDailyPushCron } from "./lib/server/cron-push";
import { runWeeklyDigestCron, runStreakRecoveryCron } from "./lib/server/email";

export type WorkerEnv = {
  DB: D1Database;
  TTS_CACHE: R2Bucket;
  CLERK_SECRET_KEY: string;
  VITE_CLERK_PUBLISHABLE_KEY: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  RESEND_API_KEY?: string;
  CLERK_WEBHOOK_SECRET?: string;
  SENTRY_DSN?: string;
  POSTHOG_PROJECT_KEY?: string;
  POSTHOG_INGEST_HOST?: string;
  VAPID_PUBLIC?: string;
  VAPID_PRIVATE?: string;
  VAPID_SUBJECT?: string;
  /**
   * Opt-in localhost dev bypass for Clerk auth. Only respected when
   * `import.meta.env.DEV === true`. MUST NEVER be set to `"true"` in
   * `wrangler.jsonc` vars — production safety. See `src/lib/server/auth-helper.ts`.
   */
  DEV_BYPASS_AUTH?: string;
};

const requestStore = new AsyncLocalStorage<{ env: WorkerEnv; ctx: ExecutionContext }>();

/**
 * Read the current CF Worker env + execution context from inside a route
 * handler. Returns null when called outside a request scope (e.g. SSR build).
 */
export function getWorkerContext(): { env: WorkerEnv; ctx: ExecutionContext } | null {
  return requestStore.getStore() ?? null;
}

export function requireWorkerContext(): { env: WorkerEnv; ctx: ExecutionContext } {
  const c = requestStore.getStore();
  if (!c) throw new Error("Worker context not available — only callable inside a request handler.");
  return c;
}

const baseFetch = createStartHandler(defaultStreamHandler);

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    return await requestStore.run({ env, ctx }, async () => {
      return await baseFetch(request);
    });
  },

  async scheduled(_event: unknown, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    // Cron handler. The 0 * * * * trigger runs hourly. Story-specific
    // schedulers register here; each is wrapped so a single failure doesn't
    // skip the rest.
    await requestStore.run({ env, ctx }, async () => {
      // US-020: reset stale streaks (consume freezes when available).
      try {
        const reset = await resetStaleStreaks(db(env.DB));
        if (reset > 0) {
          console.log(`[cron] reset ${reset} stale streak(s)`);
        }
      } catch (err) {
        console.error("[cron] resetStaleStreaks failed:", err);
      }
      // US-027: daily-nag web push (matches reminder_hour to current UTC hour).
      try {
        const r = await runDailyPushCron(db(env.DB), env);
        if (r.targeted > 0) {
          console.log(`[cron] daily push: targeted=${r.targeted} sent=${r.sent}`);
        }
      } catch (err) {
        console.error("[cron] runDailyPushCron failed:", err);
      }
      // US-028: weekly digest (Sun 10:00 UTC, gated inside the fn).
      try {
        const r = await runWeeklyDigestCron(db(env.DB), env);
        if (r.sent > 0) console.log(`[cron] weekly digest sent=${r.sent}`);
      } catch (err) {
        console.error("[cron] runWeeklyDigestCron failed:", err);
      }
      // US-028: streak recovery (daily; idempotent via notification_log).
      try {
        const r = await runStreakRecoveryCron(db(env.DB), env);
        if (r.sent > 0) console.log(`[cron] streak recovery sent=${r.sent}`);
      } catch (err) {
        console.error("[cron] runStreakRecoveryCron failed:", err);
      }
    });
  },
};
