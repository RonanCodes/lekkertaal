/**
 * Stub for the `cloudflare:workers` virtual module used in vitest unit
 * tests. The real module is provided by the workerd runtime (and patched
 * by `@cloudflare/vite-plugin` in dev) and exports `env` plus a handful of
 * worker-runtime classes. In unit tests there is no workerd, so the
 * `bootstrapDevEnvFallback` in `src/entry.server.ts` falls through to the
 * `cfEnv` undefined branch and returns silently.
 *
 * Aliased from `vitest.config.ts`. Do not import this file directly.
 */
export const env = undefined;
