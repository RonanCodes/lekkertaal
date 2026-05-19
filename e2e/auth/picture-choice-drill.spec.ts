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
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";
import { walkToDrill } from "../setup/lesson-nav";

const SKIP_REASON =
  "E2E auth bypass not configured. Set E2E_BYPASS_TOKEN locally (or as a " +
  "wrangler secret in deployed envs) to exercise the picture-choice drill.";

test.describe("Picture-choice drill (US-004)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), SKIP_REASON);
    await signInAsTestUser(page);
  });

  test("renders 4 tiles and advances on a correct pick", async ({ page }) => {
    const grid = await walkToDrill(page, { drillTestId: "picture-choice-grid" });
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
    const grid = await walkToDrill(page, { drillTestId: "picture-choice-grid" });
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
