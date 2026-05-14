import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

/**
 * Vite plugin that wraps the Cloudflare worker entry's default export with
 * our `runInRequestScope` + `setDevEnvFallback` from `worker-context.ts`.
 *
 * Background (issue #111):
 *   - `@cloudflare/vite-plugin` deploys whatever `wrangler.jsonc#main`
 *     points at as the worker entry. We point at TanStack's default-entry
 *     (`@tanstack/react-start/server-entry`) which just forwards
 *     `fetch(request, env, ctx)` to `createStartHandler(defaultStreamHandler)`,
 *     so `env`/`ctx` never reach our AsyncLocalStorage request store.
 *     Prod symptom: every signed-in user hitting `/app/*` sees the error
 *     boundary "Worker context not available, only callable inside a request
 *     handler."
 *   - We can't point `wrangler.jsonc#main` at `./src/entry.server.ts` because
 *     in dev the `@cloudflare/vite-plugin` runner-worker and the Vite SSR
 *     route-loader path each load `./src/start.ts` in separate module graphs,
 *     so `createStart()` runs twice and the Clerk middleware registration
 *     fights itself. Symptom (verified): SSR crashes with "Cannot destructure
 *     property 'auth' of 'Route.useLoaderData(...)' as it is undefined" on
 *     every request.
 *
 * What this plugin does:
 *   - Intercept the `\0virtual:cloudflare/worker-entry` virtual module (the
 *     entry the cloudflare plugin synthesises around `wrangler.jsonc#main`)
 *     and rewrite its default export so `fetch`/`scheduled` first call
 *     `setDevEnvFallback(env, ctx)` then run the inner handler inside
 *     `runInRequestScope(env, ctx, ...)`.
 *   - `enforce: 'post'` so we run after the cloudflare plugin's `load` hook.
 *
 * The cloudflare plugin emits this virtual module body (see
 * `node_modules/.../@cloudflare/vite-plugin/dist/index.mjs` around the
 * `VIRTUAL_WORKER_ENTRY` constant):
 *
 *   ${nodeJsCompat.injectGlobalCode()}
 *   import { getExportTypes } from "virtual:cloudflare/export-types";
 *   import * as mod from "virtual:cloudflare/user-entry";
 *   export * from "virtual:cloudflare/user-entry";
 *   export default mod.default ?? {};
 *   if (import.meta.hot) { ... }
 *
 * We replace `export default mod.default ?? {}` with `export default __lk_wrap(mod.default ?? {})`
 * and import our wrap helpers at the top.
 */
function wrapCloudflareWorkerEntry() {
  const VIRTUAL_WORKER_ENTRY_ID = "\0virtual:cloudflare/worker-entry";
  let isBuild = false;
  return {
    name: "lekkertaal:wrap-cloudflare-worker-entry",
    enforce: "post" as const,
    config(_userConfig: unknown, env: { command: string }) {
      isBuild = env.command === "build";
    },
    transform(code: string, id: string) {
      if (id !== VIRTUAL_WORKER_ENTRY_ID) return null;
      // Only wrap in production builds. In dev, the @cloudflare/vite-plugin
      // runner-worker and the Vite SSR route-loader path are separate module
      // graphs; injecting our worker-context wrap into the runner-worker
      // graph re-runs the worker-context module init there and breaks the
      // root-route loader. Dev relies entirely on the lazy `cloudflare:workers`
      // bootstrap path in `worker-context.ts` to populate the globalThis
      // fallback, and that already works without this wrap.
      if (!isBuild) return null;
      if (!/export\s+default\s+mod\.default/.test(code)) {
        // Bail if the cloudflare plugin's emitted shape changes; surface a
        // clear error rather than silently shipping an unwrapped worker.
        throw new Error(
          "lekkertaal:wrap-cloudflare-worker-entry: expected `export default mod.default ?? {}` in the cloudflare worker-entry virtual module, but did not find it. The @cloudflare/vite-plugin shape may have changed; update this transform.",
        );
      }
      const banner =
        'import { runInRequestScope as __lk_runInRequestScope, setDevEnvFallback as __lk_setDevEnvFallback } from "/src/lib/server/worker-context";\n';
      const wrapFn = `
function __lk_wrap_worker_entry(inner) {
  if (!inner || typeof inner !== "object") return inner;
  const wrapped = {};
  if (typeof inner.fetch === "function") {
    wrapped.fetch = async function (request, env, ctx) {
      __lk_setDevEnvFallback(env, ctx);
      return __lk_runInRequestScope(env, ctx, () => inner.fetch(request, env, ctx));
    };
  }
  if (typeof inner.scheduled === "function") {
    wrapped.scheduled = async function (event, env, ctx) {
      __lk_setDevEnvFallback(env, ctx);
      return __lk_runInRequestScope(env, ctx, () => inner.scheduled(event, env, ctx));
    };
  }
  return wrapped;
}
`;
      const rewritten = code.replace(
        /export\s+default\s+(mod\.default\s*\?\?\s*\{\})\s*;?/,
        `${wrapFn}\nexport default __lk_wrap_worker_entry($1);`,
      );
      return banner + rewritten;
    },
  };
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "./src/entry.server.ts" },
    }),
    viteReact(),
    wrapCloudflareWorkerEntry(),
  ],
})

export default config
