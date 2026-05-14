/**
 * Signed-in smoke tests for /app/* routes.
 *
 * Uses @clerk/testing to bypass interactive auth (testing token + ticket
 * sign-in via the Clerk Backend API). See `e2e/setup/clerk-auth.ts` for
 * the full env-var contract.
 *
 * Tests are skipped automatically when the env is missing so they still
 * appear in `playwright test --list` for CI sanity-checking but do not
 * fail unattended runs.
 */

import { test, expect } from "@playwright/test";
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";

const skipReason =
  "Clerk testing env missing. Set CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY, " +
  "and CLERK_TEST_USER_EMAIL to run the signed-in flow.";

test.describe("Signed-in /app/path", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), skipReason);
    await signInAsTestUser(page);
  });

  test("renders without redirect to /sign-in", async ({ page }) => {
    const response = await page.goto("/app/path", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);
    expect(page.url()).toContain("/app/path");
    expect(page.url()).not.toContain("/sign-in");
  });

  test("shows the top-bar streak / XP / coin chips", async ({ page }) => {
    await page.goto("/app/path");
    // AppShell exposes ARIA labels on the chips so we do not depend on emoji.
    // Use { exact: true } so the locator does not collide with the daily-quest
    // "claim quest xp" button rendered further down the page.
    await expect(page.getByLabel("xp", { exact: true })).toBeVisible();
    await expect(page.getByLabel("coins", { exact: true })).toBeVisible();
    // Streak chip uses the `title` attribute (no aria-label) — fall back to text
    await expect(page.getByRole("heading", { name: /your path/i })).toBeVisible();
  });

  test("navigates from /app/path into a unit detail page", async ({ page }) => {
    await page.goto("/app/path");
    // First non-locked unit renders as an <a href="/app/unit/...">
    const firstUnitLink = page.locator('a[href^="/app/unit/"]').first();
    await expect(firstUnitLink).toBeVisible();
    await firstUnitLink.click();
    await page.waitForURL(/\/app\/unit\//);
    expect(page.url()).toMatch(/\/app\/unit\//);
  });

  test("shows the daily quests ribbon with 3 quests", async ({ page }) => {
    await page.goto("/app/path");
    const ribbon = page.getByRole("region", { name: /daily quests/i });
    await expect(ribbon).toBeVisible();
    const quests = page.getByTestId("daily-quest");
    await expect(quests).toHaveCount(3);
  });
});
