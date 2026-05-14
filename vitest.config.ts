import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Vitest config.
 *
 * - jsdom env for components that touch DOM
 * - alias `#/*` resolves to `./src/*` (matches tsconfig + package.json imports)
 * - test files: src/**\/*.test.ts(x), no e2e (Playwright owns e2e/**)
 */
export default defineConfig({
  resolve: {
    alias: {
      "#": resolve(__dirname, "src"),
      // `cloudflare:workers` is a virtual module provided by the workerd
      // runtime; it doesn't exist in node, so vitest can't resolve it.
      // `src/entry.server.ts` dynamic-imports it inside an `import.meta.env.DEV`
      // gate to bootstrap a dev env fallback (ADR 0007). For unit tests we
      // alias it to an empty stub; the bootstrap returns silently when
      // `cfWorkers.env` is undefined.
      "cloudflare:workers": resolve(__dirname, "src/test-stubs/cloudflare-workers.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", "dist", "e2e", ".wrangler"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**", "src/components/drills/**"],
      exclude: ["**/*.test.ts", "**/*.d.ts", "**/__tests__/**"],
    },
  },
});
