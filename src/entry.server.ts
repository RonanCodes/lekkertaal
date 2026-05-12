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
    // Cron handler — wired up by US-027 (web push) + US-028 (email).
    await requestStore.run({ env, ctx }, async () => {
      // No-op placeholder; story-specific schedulers will register here.
    });
  },
};
