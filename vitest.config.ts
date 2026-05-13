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
