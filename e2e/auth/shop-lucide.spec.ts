/**
 * E2E coverage for the shop page Lucide migration (US-010 / PR #149).
 *
 * Asserts that:
 *   - the three balance cards (Coins / Streak freezes / Hints) render
 *     Lucide SVGs, not emoji glyphs,
 *   - every shop item card resolves its icon through `resolveShopIcon` and
 *     renders an inline <svg>,
 *   - none of the visible page text contains the legacy emoji glyphs we
 *     used to ship (🪙 ❄️ 💡 🎟️ 🎁).
 *
 * The shop catalogue is in-memory (see `src/lib/server/shop.ts`), so any
 * signed-in user can hit /app/shop and the items appear immediately —
 * no per-test seed is required.
 *
 * Skipped when the e2e bypass header is not configured.
 */

import { test, expect } from "@playwright/test";
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";

const SKIP_REASON =
  "E2E auth bypass not configured. Set E2E_BYPASS_TOKEN locally (or as a " +
  "wrangler secret in deployed envs) to exercise the shop page.";

const LEGACY_EMOJI_GLYPHS = ["🪙", "❄️", "💡", "🎟️", "🎁"] as const;

test.describe("Shop page Lucide migration (US-010)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), SKIP_REASON);
    await signInAsTestUser(page);
  });

  test("balance cards render Lucide SVGs and the Coins card is present", async ({
    page,
  }) => {
    await page.goto("/app/shop");

    const coinsCard = page.locator('[data-testid="shop-balance-card"][data-balance-label="coins"]');
    await expect(coinsCard).toBeVisible();
    await expect(coinsCard.locator("svg")).toBeVisible();

    const freezesCard = page.locator(
      '[data-testid="shop-balance-card"][data-balance-label="streak-freezes"]',
    );
    await expect(freezesCard).toBeVisible();
    await expect(freezesCard.locator("svg")).toBeVisible();

    const hintsCard = page.locator(
      '[data-testid="shop-balance-card"][data-balance-label="hints"]',
    );
    await expect(hintsCard).toBeVisible();
    await expect(hintsCard.locator("svg")).toBeVisible();
  });

  test("every shop item card renders a Lucide SVG icon", async ({ page }) => {
    await page.goto("/app/shop");

    const icons = page.getByTestId("shop-item-icon");
    const count = await icons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const icon = icons.nth(i);
      await expect(icon).toBeVisible();
      // Lucide renders an inline <svg>; emoji-based icons would not.
      await expect(icon.locator("svg")).toBeVisible();
    }
  });

  test("page contains no legacy emoji glyphs in visible text", async ({ page }) => {
    await page.goto("/app/shop");

    const body = await page.locator("body").innerText();
    for (const glyph of LEGACY_EMOJI_GLYPHS) {
      expect(
        body.includes(glyph),
        `Expected shop page to be free of legacy glyph "${glyph}", but it was present.`,
      ).toBe(false);
    }
  });
});
