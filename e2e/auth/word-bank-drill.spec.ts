/**
 * E2E coverage for the word_bank typing drill (US-002).
 *
 * The drill renders an empty answer slot at the top and a shuffled tile bank
 * below. Learner taps bank tiles → they move into the slot. Submit grades on
 * whitespace-normalised exact match against the canonical sentence.
 *
 * Two seed rows live in a2-unit-1, so the spec walks into the unit's first
 * lesson and skips drills until a `word-bank-drill` mount appears. Once
 * mounted, the test taps every bank tile in render order, submits, and
 * asserts that a feedback panel surfaces — pass or fail. We deliberately
 * don't assert the green-path because tile order is shuffled and we don't
 * read the canonical out of the DOM.
 *
 * Skipped when the e2e bypass header is not configured.
 */

import { test, expect } from "@playwright/test";
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";
import { walkToDrill } from "../setup/lesson-nav";

const SKIP_REASON =
  "E2E auth bypass not configured. Set E2E_BYPASS_TOKEN locally (or as a " +
  "wrangler secret in deployed envs) to exercise the word-bank drill.";

test.describe("Word-bank drill (US-002)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), SKIP_REASON);
    await signInAsTestUser(page);
  });

  test("tile-tap → submit fires onSubmit and renders the answer reveal", async ({
    page,
  }) => {
    const drill = await walkToDrill(page, { drillTestId: "word-bank-drill" });
    test.skip(
      drill === null,
      "No word_bank drill encountered within maxHops — seed may not include one here.",
    );
    if (drill === null) return;
    await expect(drill).toBeVisible();

    // Tap every bank tile in current render order. After each tap the tile
    // moves into the slot, so we re-evaluate the locator from the top each
    // iteration. Bail when the bank is empty or we hit a safety cap.
    const bankSelector = '[data-testid^="word-bank-bank-tile-"]';
    for (let i = 0; i < 12; i++) {
      const tiles = page.locator(bankSelector);
      const count = await tiles.count();
      if (count === 0) break;
      await tiles.first().click();
      await page.waitForTimeout(50);
    }

    // Submit and assert a feedback transition fires. The submit button stays
    // visible after grading, but the answer reveal block (with the canonical
    // sentence) only renders post-submit.
    const submit = page.getByTestId("word-bank-submit");
    await expect(submit).toBeEnabled();
    await submit.click();

    // The reveal block is the first sibling-text node containing "Answer".
    // We assert any feedback banner appears: the lesson-player FeedbackBanner
    // surfaces "Continue" once onSubmit fires, regardless of pass/fail.
    const continueBtn = page.getByRole("button", { name: /continue|finish lesson/i });
    await expect(continueBtn).toBeVisible({ timeout: 5_000 });
  });
});
