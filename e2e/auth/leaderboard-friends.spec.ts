/**
 * Signed-in e2e tests for the friends-leaderboard tab (#58).
 *
 * Real friend seeding via the Clerk dev instance + D1 is too heavy for CI
 * (would need a second pre-seeded test user and an accepted friendship
 * row in the worker's bound D1). Instead, this spec exercises everything
 * we can verify without that fixture:
 *
 *   - Both scope tabs render (Global / Friends).
 *   - Friends tab is selected when `?scope=friends`.
 *   - The empty state copy + "Find friends" CTA show for a user with no
 *     accepted friends (the default state for the e2e test user).
 *   - Window-tab navigation preserves scope (clicking "This week" while
 *     on Friends keeps scope=friends in the URL).
 *
 * The 2-friend / 3-row case from issue #58 is covered by the integration
 * test in `src/lib/server/__tests__/leaderboard.integration.test.ts`.
 * Manual smoke for the populated case: log in as a user with 2+ accepted
 * friends, navigate to `/app/leaderboard?scope=friends`, expect 3+ rows.
 */
import { test, expect } from "@playwright/test";
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";

const skipReason =
  "Clerk testing env missing. Set CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY, " +
  "and CLERK_TEST_USER_EMAIL to run the signed-in flow.";

test.describe("Leaderboard — friends tab", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), skipReason);
    await signInAsTestUser(page);
  });

  test("both scope tabs render on /app/leaderboard", async ({ page }) => {
    await page.goto("/app/leaderboard");
    await expect(page.getByTestId("leaderboard-scope-global")).toBeVisible();
    await expect(page.getByTestId("leaderboard-scope-friends")).toBeVisible();
  });

  test("global is the default scope", async ({ page }) => {
    await page.goto("/app/leaderboard");
    await expect(page.getByTestId("leaderboard-scope-global")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("leaderboard-scope-friends")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  test("clicking Friends tab navigates with scope=friends in URL", async ({ page }) => {
    await page.goto("/app/leaderboard");
    await page.getByTestId("leaderboard-scope-friends").click();
    await page.waitForURL(/scope=friends/);
    await expect(page.getByTestId("leaderboard-scope-friends")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("empty state appears when the test user has no accepted friends", async ({ page }) => {
    await page.goto("/app/leaderboard?scope=friends");
    // The test fixture user has no friend rows, so the empty state and CTA
    // must render. If a future test fixture seeds friends, this assertion
    // will tighten to row-count checks.
    const empty = page.getByTestId("leaderboard-friends-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(/add friends/i);
    await expect(page.getByTestId("leaderboard-friends-cta")).toBeVisible();
  });

  test("window tabs preserve scope=friends", async ({ page }) => {
    await page.goto("/app/leaderboard?scope=friends");
    // Click the "This week" window tab.
    await page.getByRole("link", { name: /this week/i }).click();
    await page.waitForURL(/window=week/);
    expect(page.url()).toContain("scope=friends");
    expect(page.url()).toContain("window=week");
  });
});
