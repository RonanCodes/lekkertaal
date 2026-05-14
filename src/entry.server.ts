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
import { runDailyQuestsCron } from "./lib/server/daily-quests";
import { runWeeklyLeagueRoll } from "./lib/server/leagues";
import { configureLogger, withRequestLogContext, log } from "./lib/logger";

export type WorkerEnv = {
  DB: D1Database;
  TTS_CACHE: R2Bucket;
  /**
   * R2 bucket for image-input drill assets (AI-SDK-7). Holds the PNGs that
   * back `image_word` drills. Read-mostly: writes happen offline via
   * `wrangler r2 object put`, runtime code only ever reads.
   */
  IMAGES: R2Bucket;
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
  /** Logtape minimum level. Default 'info'. Override to 'debug' for verbose. */
  LOG_LEVEL?: string;
  VAPID_PUBLIC?: string;
  VAPID_PRIVATE?: string;
  VAPID_SUBJECT?: string;
  /**
   * Opt-in localhost dev bypass for Clerk auth. Only respected when
   * `import.meta.env.DEV === true`. MUST NEVER be set to `"true"` in
   * `wrangler.jsonc` vars (production safety). See `src/lib/server/auth-helper.ts`.
   */
  DEV_BYPASS_AUTH?: string;
  /**
   * E2E playwright shared-secret. When `import.meta.env.DEV === true` AND
   * the request has header `x-lekkertaal-e2e-bypass` matching this value,
   * `requireUserClerkId()` returns the seed user `seed_ronan` without
   * calling Clerk. Dead-code-eliminated in production builds.
   */
  E2E_BYPASS_TOKEN?: string;
};

const requestStore = new AsyncLocalStorage<{ env: WorkerEnv; ctx: ExecutionContext }>();

/**
 * Dev-only fallback: the AsyncLocalStorage scope is sometimes lost across
 * TanStack Start's server-function RPC dispatch in Vite dev mode (likely a
 * separate microtask chain). To keep dev usable, we cache the most recent
 * env binding on globalThis and use it as a fallback. NEVER used in production
 * because the prod worker runs each request in its own isolate and the
 * AsyncLocalStorage is reliable there.
 *
 * In addition, route loaders in Vite dev mode (TanStack Start v6) execute
 * via Vite's SSR module graph, NOT through the @cloudflare/vite-plugin
 * worker `fetch` path. That means `setDevEnvFallback` never fires for
 * route-loader-only requests, so we ALSO eagerly synthesize a fallback env
 * at module-load time using `wrangler.getPlatformProxy()`. The synthesized
 * env is a real miniflare-backed binding set (D1, R2, .dev.vars secrets),
 * cached on globalThis. Route loaders pick it up via `getWorkerContext()`.
 * Production builds skip the bootstrap entirely (gated on `import.meta.env.DEV`).
 *
 * See: docs/adr/0007-vite-dev-env-bootstrap.md.
 */
type DevEnvCache = { env: WorkerEnv; ctx: ExecutionContext } | null;
const DEV_ENV_KEY = "__lekkertaal_dev_env__";
function setDevEnvFallback(env: WorkerEnv, ctx: ExecutionContext): void {
  if (import.meta.env.DEV) {
    (globalThis as Record<string, unknown>)[DEV_ENV_KEY] = { env, ctx };
  }
}
function readDevEnvFallback(): DevEnvCache {
  if (!import.meta.env.DEV) return null;
  return ((globalThis as Record<string, unknown>)[DEV_ENV_KEY] as DevEnvCache) ?? null;
}

/**
 * Stub ExecutionContext for dev. The real CF runtime provides one; in dev
 * we don't have one until a request actually hits the worker fetch path.
 * Route loaders rarely need ctx.waitUntil / ctx.passThroughOnException, so
 * a no-op stub is acceptable. If a consumer ever needs real ctx semantics
 * in dev, it should branch on `import.meta.env.DEV` and skip the call.
 */
function makeDevExecutionContext(): ExecutionContext {
  const stub: ExecutionContext = {
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    props: {},
  };
  return stub;
}

/**
 * Eagerly bootstrap a dev env fallback at module-load time. Reads the CF
 * env directly from `cloudflare:workers`, which the @cloudflare/vite-plugin
 * exposes as a module-level `env` reference once the worker runner has
 * been initialised. This gives us real D1, R2, and `.dev.vars` bindings
 * without going through `entry.server.fetch`.
 *
 * Skipped entirely in production builds (dead-code-eliminated by Vite via
 * the `import.meta.env.DEV` gate). The dynamic import isolates the
 * `cloudflare:workers` module from any non-workerd test/SSR path.
 */
async function bootstrapDevEnvFallback(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (readDevEnvFallback()) return;
  try {
    // `cloudflare:workers` is a virtual module provided by the workerd
     // runtime (and patched by @cloudflare/vite-plugin in dev). Not in our
     // tsconfig `types` because the full @cloudflare/workers-types set
     // conflicts with DOM types we rely on, so we cast through `unknown`.
    const cfWorkers = (await import(
      // @ts-expect-error -- virtual module, types not in tsconfig
      "cloudflare:workers"
    )) as { env?: WorkerEnv };
    const cfEnv = cfWorkers.env;
    if (!cfEnv) {
      // Not running inside the @cloudflare/vite-plugin runner-worker (e.g.
      // a vitest unit test that imports this module). Skip silently.
      return;
    }
    // Layer `process.env` over the workerd env so shell-set overrides
    // (notably DEV_BYPASS_AUTH from `scripts/dev-bypass-auth.sh`) win.
    const merged = { ...cfEnv } as WorkerEnv & Record<string, unknown>;
    if (typeof process !== "undefined") {
      for (const [k, v] of Object.entries(process.env)) {
        if (typeof v === "string" && v.length > 0 && !(k in merged)) {
          (merged as Record<string, unknown>)[k] = v;
        }
      }
      if (typeof process.env.DEV_BYPASS_AUTH === "string") {
        (merged as Record<string, unknown>).DEV_BYPASS_AUTH = process.env.DEV_BYPASS_AUTH;
      }
    }
    setDevEnvFallback(merged, makeDevExecutionContext());
    // eslint-disable-next-line no-console
    console.log("[entry.server] dev env fallback bootstrapped from cloudflare:workers");
  } catch (err) {
    // Don't crash dev startup — log and let consumers see the existing
    // "Worker context not available" error so the failure is debuggable.
    // eslint-disable-next-line no-console
    console.warn("[entry.server] failed to bootstrap dev env fallback:", err);
  }
}

// Top-level await: ESM module init waits for the bootstrap to complete
// before any importer's code runs. In production this is a no-op (the
// function returns immediately when DEV is false).
await bootstrapDevEnvFallback();

/**
 * Read the current CF Worker env + execution context from inside a route
 * handler. Returns null when called outside a request scope (e.g. SSR build).
 */
export function getWorkerContext(): { env: WorkerEnv; ctx: ExecutionContext } | null {
  return requestStore.getStore() ?? readDevEnvFallback();
}

export function requireWorkerContext(): { env: WorkerEnv; ctx: ExecutionContext } {
  const c = requestStore.getStore() ?? readDevEnvFallback();
  if (!c) throw new Error("Worker context not available — only callable inside a request handler.");
  return c;
}

const baseFetch = createStartHandler(defaultStreamHandler);

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    setDevEnvFallback(env, ctx);
    configureLogger({ env });
    return await requestStore.run({ env, ctx }, async () => {
      return await withRequestLogContext(request, async () => {
        log.debug("request received", { method: request.method, url: request.url });
        return await baseFetch(request);
      });
    });
  },

  async scheduled(_event: unknown, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    // Cron handler. The 0 * * * * trigger runs hourly. Story-specific
    // schedulers register here; each is wrapped so a single failure doesn't
    // skip the rest.
    configureLogger({ env });
    await requestStore.run({ env, ctx }, async () => {
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
      // US-028: streak recovery (daily; idempotent via notification_log).
      try {
        const r = await runStreakRecoveryCron(db(env.DB), env);
        if (r.sent > 0) log.info("cron: streak recovery", { sent: r.sent });
      } catch (err) {
        log.error("cron: runStreakRecoveryCron failed", { err });
      }
      // P2-CON-3: seed today's daily quests for every user. Idempotent —
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
      // P2-ENG-1: weekly league roll. The CF Workers cron fires hourly; we
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
