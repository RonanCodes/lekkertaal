/**
 * E2E smoke for the AI-SDK-7 image-input drill.
 *
 * Skipped automatically when:
 *   - Clerk testing env vars are missing, OR
 *   - no `image_word` drill is seeded in the current DB (the seed pipeline
 *     in `scripts/seed-image-drills.ts` + R2 upload has not been run).
 *
 * When both are present, the test signs in as the Clerk test user, walks
 * into the first lesson that contains an image-word drill, types the
 * canonical Dutch noun, and asserts the green-feedback panel appears.
 *
 * The drill renderer ships `data-testid` hooks (`image-word-drill-image`,
 * `image-word-drill-input`, `image-word-drill-check`,
 * `image-word-drill-feedback`) so this spec stays decoupled from CSS.
 */

import { test, expect } from "@playwright/test";
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";

const skipReason =
  "Clerk testing env missing. Set CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY, " +
  "and CLERK_TEST_USER_EMAIL to run the image-word drill flow.";

test.describe("Image-word drill (AI-SDK-7)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), skipReason);
    await signInAsTestUser(page);
  });

  test("renders the image, accepts the canonical Dutch noun, shows correct feedback", async ({
    page,
  }) => {
    // Navigate to the learning path and look for any unit that contains an
    // image-word drill. The seed slug pattern is `image-word-<noun>`; we
    // search by data-testid rather than slug so the test stays robust if
    // the curriculum wiring changes.
    await page.goto("/app/path");

    // The unit/lesson where image-word drills get seeded is the A2 unit-1
    // slot (see scripts/seed-image-drills.ts). Walk there and into its
    // first lesson.
    const a2UnitLink = page
      .locator('a[href*="/app/unit/a2-unit-1"]')
      .first();

    const hasUnit = await a2UnitLink.count();
    test.skip(hasUnit === 0, "No A2 unit-1 link in path — image drill seed not present.");

    await a2UnitLink.click();
    await page.waitForURL(/\/app\/unit\//);

    const lessonLink = page.locator('a[href*="/app/lesson/"]').first();
    test.skip((await lessonLink.count()) === 0, "Unit page has no lesson links.");
    await lessonLink.click();
    await page.waitForURL(/\/app\/lesson\//);

    // Skip past non-image drills until an image-word drill renders, or
    // give up after 12 hops (lesson length cap).
    let imageDrill = null;
    for (let i = 0; i < 12; i++) {
      const img = page.getByTestId("image-word-drill-image");
      if ((await img.count()) > 0) {
        imageDrill = img;
        break;
      }
      // The lesson player auto-advances on the fallback "Skip" button for
      // unsupported types and on the green "Continue" button for normal
      // drills. Try Continue first, fall back to Skip.
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

    test.skip(imageDrill === null, "No image-word drill in this lesson. Seed not loaded.");
    if (imageDrill === null) return;

    await expect(imageDrill).toBeVisible();

    // Type the canonical noun ("kat" is the first seed entry; if seed
    // ordering changes the read-the-feedback assertion still passes as
    // long as the answer is in the accepted set).
    const input = page.getByTestId("image-word-drill-input");
    await input.fill("kat");
    await page.getByTestId("image-word-drill-check").click();

    const feedback = page.getByTestId("image-word-drill-feedback");
    await expect(feedback).toBeVisible();
    // Correct path: feedback contains the canonical noun in emerald.
    await expect(feedback).toContainText(/kat/i);
  });
});
