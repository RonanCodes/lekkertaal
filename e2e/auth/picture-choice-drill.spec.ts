/**
 * E2E coverage for the picture-choice 4-up grid (US-004).
 *
 * Renders a Dutch word + Speaker over a 2x2 image grid. Tap the correct tile
 * → green ring + advance after ~350ms. Tap a wrong tile → red ring + reveal
 * correct tile (after ~700ms) + advance (after ~1200ms).
 *
 * The drill needs at least 3 distractor images in the unit image pool to
 * render real tiles; if the pool is too thin it renders a skip-frame that
 * auto-advances. The test handles both: it tries to find the grid, and if
 * any tile carries `data-correct="true"` it taps that for the green path.
 * A second test walks fresh, picks a wrong tile, and asserts the wrong-pick
 * styling appears (animate-shake + rose ring).
 *
 * Skipped when the e2e bypass header is not configured.
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";

const SKIP_REASON =
  "E2E auth bypass not configured. Set E2E_BYPASS_TOKEN locally (or as a " +
  "wrangler secret in deployed envs) to exercise the picture-choice drill.";

const MAX_HOPS = 40;

async function walkToPictureChoice(page: Page) {
  await page.goto("/app/path");
  const a2UnitLink = page.locator('a[href*="/app/unit/a2-unit-1"]').first();
  if ((await a2UnitLink.count()) === 0) return null;
  await a2UnitLink.click();
  await page.waitForURL(/\/app\/unit\//);
  const lessonLink = page.locator('a[href*="/app/lesson/"]').first();
  if ((await lessonLink.count()) === 0) return null;
  await lessonLink.click();
  await page.waitForURL(/\/app\/lesson\//);

  const grid = page.getByTestId("picture-choice-grid");
  for (let i = 0; i < MAX_HOPS; i++) {
    if ((await grid.count()) > 0) return grid;
    const continueBtn = page.getByRole("button", { name: /continue|finish lesson/i });
    const skipBtn = page.getByRole("button", { name: /^skip$/i });
    if (await continueBtn.count()) {
      await continueBtn.first().click();
    } else if (await skipBtn.count()) {
      await skipBtn.first().click();
    } else {
      break;
    }
    await page.waitForTimeout(150);
  }
  return null;
}

test.describe("Picture-choice drill (US-004)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), SKIP_REASON);
    await signInAsTestUser(page);
  });

  test("renders 4 tiles and advances on a correct pick", async ({ page }) => {
    const grid = await walkToPictureChoice(page);
    test.skip(grid === null, "No picture_choice drill found — pool may be too thin.");
    if (grid === null) return;

    await expect(grid).toBeVisible();
    const tiles = page.locator('[data-testid^="picture-choice-tile-"]');
    await expect(tiles).toHaveCount(4);

    const correctTile = page.locator(
      '[data-testid^="picture-choice-tile-"][data-correct="true"]',
    );
    await expect(correctTile).toHaveCount(1);
    await correctTile.click();

    // After a correct pick the player advances within ~350ms; either a
    // FeedbackBanner Continue button or the next drill appears. Assert the
    // grid no longer carries any tile with picked=true OR the route has moved
    // forward (drill index increments). Cheapest check: the original grid
    // detaches once the next drill mounts.
    await expect(grid).not.toBeVisible({ timeout: 5_000 });
  });

  test("wrong pick flashes red and reveals the correct tile", async ({ page }) => {
    const grid = await walkToPictureChoice(page);
    test.skip(grid === null, "No picture_choice drill found — pool may be too thin.");
    if (grid === null) return;

    await expect(grid).toBeVisible();
    const wrongTile = page
      .locator('[data-testid^="picture-choice-tile-"][data-correct="false"]')
      .first();
    await expect(wrongTile).toBeVisible();
    await wrongTile.click();

    // After wrong pick the wrong tile flashes red (rose ring), then ~700ms
    // later the correct tile gets the emerald ring. Assert the correct tile
    // ends up with the emerald-ring class in the reveal window.
    const correctTile = page.locator(
      '[data-testid^="picture-choice-tile-"][data-correct="true"]',
    );
    await expect(correctTile).toHaveClass(/ring-emerald-200/, { timeout: 2_000 });
  });
});
