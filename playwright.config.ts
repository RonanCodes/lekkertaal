import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config.
 *
 * - tests live in e2e/
 * - runs against `pnpm dev` on http://localhost:3000 by default
 *   (override with PLAYWRIGHT_BASE_URL=https://lekkertaal.ronanconnolly.dev for prod smoke)
 * - Chromium only (other browsers can be added when we ship enough features to need them)
 * - 30s test timeout, 5s action timeout
 */
const PORT = 3000;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // serial because tests share auth state / D1
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Only spin up the dev server locally; in CI we point at a deployed
  // preview / prod URL via PLAYWRIGHT_BASE_URL.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
