/**
 * Server-only Cloudflare Worker context.
 *
 * Holds the AsyncLocalStorage request store, the dev env fallback, and the
 * `getWorkerContext()` / `requireWorkerContext()` helpers that route loaders
 * and server functions use to reach the CF Worker `env` (D1, R2, secrets).
 *
 * Why this module exists (issue #99): pre-#95, these helpers lived inline in
 * `src/entry.server.ts`. After PR #95 added a top-level `await` to bootstrap
 * the dev env fallback from `cloudflare:workers`, Vite's bundler started
 * pulling `entry.server.ts` into the CLIENT graph for some `.tsx` route files
 * that imported `requireWorkerContext` from it. Result: the browser tried to
 * load `node:async_hooks` (via `AsyncLocalStorage`) and Clerk's `<SignIn/>` /
 * `<SignUp/>` failed to mount.
 *
 * Two changes break the leak:
 *
 *   1. The `'@tanstack/react-start/server-only'` marker import below makes
 *      TanStack Start's import-protection plugin reject any client-graph
 *      module that transitively imports this file. The build fails loudly
 *      if a `.tsx` route accidentally reaches in.
 *   2. The dev bootstrap is now lazy: `getWorkerContext()` calls
 *      `ensureDevEnvBootstrapped()` on first use, instead of a top-level
 *      `await`. Module-init has no side effects beyond constructing the
 *      AsyncLocalStorage instance, so the bundler can split this module
 *      cleanly into the SSR graph.
 *
 * See `docs/adr/0007-vite-dev-env-bootstrap.md` for the dev bootstrap
 * background and `docs/adr/0002-async-local-storage-globalthis-dev-fallback.md`
 * for the AsyncLocalStorage + globalThis fallback pattern.
 */
import "@tanstack/react-start/server-only";
import type { D1Database, R2Bucket, ExecutionContext } from "@cloudflare/workers-types";
import { AsyncLocalStorage } from "node:async_hooks";

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

type DevEnvCache = { env: WorkerEnv; ctx: ExecutionContext } | null;
const DEV_ENV_KEY = "__lekkertaal_dev_env__";

function setDevEnvFallbackInternal(env: WorkerEnv, ctx: ExecutionContext): void {
  if (import.meta.env.DEV) {
    (globalThis as Record<string, unknown>)[DEV_ENV_KEY] = { env, ctx };
  }
}

function readDevEnvFallback(): DevEnvCache {
  if (!import.meta.env.DEV) return null;
  return ((globalThis as Record<string, unknown>)[DEV_ENV_KEY] as DevEnvCache) ?? null;
}

/**
 * Public wrapper for `setDevEnvFallbackInternal` so `entry.server.ts` can
 * keep mirroring the worker `fetch` env into the globalThis cache.
 */
export function setDevEnvFallback(env: WorkerEnv, ctx: ExecutionContext): void {
  setDevEnvFallbackInternal(env, ctx);
}

/**
 * Stub ExecutionContext for dev. The real CF runtime provides one, in dev
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

let devBootstrapPromise: Promise<void> | null = null;

/**
 * Lazily bootstrap a dev env fallback on first `getWorkerContext()` call.
 * Reads the CF env from `cloudflare:workers`, which the
 * `@cloudflare/vite-plugin` exposes as a module-level `env` reference once
 * the worker runner has been initialised. Cached on globalThis so route
 * loaders pick it up via `getWorkerContext()`.
 *
 * Skipped entirely in production builds (dead-code-eliminated by Vite via
 * the `import.meta.env.DEV` gate). The dynamic import isolates the
 * `cloudflare:workers` module from any non-workerd test/SSR path.
 *
 * Lazy rather than top-level await (per issue #99): top-level await was
 * the trigger that pulled this module's `node:async_hooks` import into
 * the client bundle for `.tsx` route files. Moving the bootstrap into
 * a first-call code path lets the bundler split the SSR graph cleanly.
 */
function ensureDevEnvBootstrapped(): Promise<void> | null {
  if (!import.meta.env.DEV) return null;
  if (readDevEnvFallback()) return null;
  if (devBootstrapPromise) return devBootstrapPromise;
  devBootstrapPromise = (async () => {
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
      setDevEnvFallbackInternal(merged, makeDevExecutionContext());
      console.log("[worker-context] dev env fallback bootstrapped from cloudflare:workers");
    } catch (err) {
      // Don't crash dev startup, log and let consumers see the existing
      // "Worker context not available" error so the failure is debuggable.
      console.warn("[worker-context] failed to bootstrap dev env fallback:", err);
    }
  })();
  return devBootstrapPromise;
}

/**
 * Async variant used by routes that can await before reading the context.
 * Triggers the lazy dev bootstrap and waits for it.
 */
export async function getWorkerContextAsync(): Promise<
  { env: WorkerEnv; ctx: ExecutionContext } | null
> {
  const p = ensureDevEnvBootstrapped();
  if (p) await p;
  return requestStore.getStore() ?? readDevEnvFallback();
}

/**
 * Read the current CF Worker env + execution context from inside a route
 * handler. Returns null when called outside a request scope (e.g. SSR build).
 *
 * In dev mode, fires-and-forgets the lazy bootstrap on first call. The first
 * call to `getWorkerContext()` in a fresh dev session may see `null` because
 * the bootstrap is still in flight, but subsequent calls within the same
 * tick (or after one microtask) will see the populated fallback. Callers
 * that need to await should use `requireWorkerContext()` (which throws)
 * or `getWorkerContextAsync()` (which awaits).
 */
export function getWorkerContext(): { env: WorkerEnv; ctx: ExecutionContext } | null {
  // Kick off the lazy bootstrap. Result is cached on globalThis once resolved.
  ensureDevEnvBootstrapped();
  return requestStore.getStore() ?? readDevEnvFallback();
}

export function requireWorkerContext(): { env: WorkerEnv; ctx: ExecutionContext } {
  const c = requestStore.getStore() ?? readDevEnvFallback();
  if (!c) {
    // In dev, the bootstrap might still be in flight. Kick it off but throw
    // a synchronous error so the call site gets a useful stack trace. The
    // user can either switch to `getWorkerContextAsync()` or ensure the
    // bootstrap has had a chance to run (any prior request triggers it).
    ensureDevEnvBootstrapped();
    throw new Error("Worker context not available, only callable inside a request handler.");
  }
  return c;
}

/**
 * Run an async function inside the AsyncLocalStorage request scope. Used by
 * `entry.server.ts`'s `fetch` and `scheduled` handlers to bind the CF env
 * for the lifetime of one request.
 */
export function runInRequestScope<T>(
  env: WorkerEnv,
  ctx: ExecutionContext,
  fn: () => Promise<T>,
): Promise<T> {
  return requestStore.run({ env, ctx }, fn);
}

// Kick off the dev env bootstrap as a fire-and-forget side effect at module
// load time. This is a server-only module (per the marker import at the top),
// so this side effect cannot leak into the client bundle. The bootstrap is
// async but does NOT use top-level await, so the bundler can split this
// module cleanly into the SSR graph. By the time the first request hits a
// route loader, the cfWorkers env has been read and the globalThis fallback
// is populated.
//
// Production builds skip the bootstrap entirely (dead-code-eliminated by
// Vite via the `import.meta.env.DEV` gate inside `ensureDevEnvBootstrapped`).
void ensureDevEnvBootstrapped();
