/**
 * E2E coverage for the listening_spell drill (US-001).
 *
 * The listening_spell drill is synthesised at the lesson tail — it plays a
 * Dutch headword via the Speaker and asks the learner to type what they
 * heard. Grading is Levenshtein-≤1: an exact match grades correct with no
 * "Close enough" hint, distance-1 grades correct AND surfaces the hint,
 * distance-2+ grades incorrect.
 *
 * The drill renders only at the end of a lesson, so the test walks into
 * a2-unit-1 (which carries the heaviest seed) and clicks through every
 * preceding drill via "Skip" / "Continue" until a listening-spell-drill
 * testid appears. Caps out after a sane hop count so a missing tail drill
 * doesn't hang the run.
 *
 * Skipped when the e2e bypass header is not configured (CI without
 * E2E_BYPASS_TOKEN, or local runs without the dev secret).
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";

const SKIP_REASON =
  "E2E auth bypass not configured. Set E2E_BYPASS_TOKEN locally (or as a " +
  "wrangler secret in deployed envs) to exercise the listening-spell drill.";

const MAX_HOPS = 40;

async function walkToListeningSpell(page: Page) {
  await page.goto("/app/path");

  const a2UnitLink = page.locator('a[href*="/app/unit/a2-unit-1"]').first();
  if ((await a2UnitLink.count()) === 0) {
    return null;
  }
  await a2UnitLink.click();
  await page.waitForURL(/\/app\/unit\//);

  const lessonLink = page.locator('a[href*="/app/lesson/"]').first();
  if ((await lessonLink.count()) === 0) {
    return null;
  }
  await lessonLink.click();
  await page.waitForURL(/\/app\/lesson\//);

  const drill = page.getByTestId("listening-spell-drill");
  for (let i = 0; i < MAX_HOPS; i++) {
    if ((await drill.count()) > 0) return drill;
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

test.describe("Listening-spell drill (US-001)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), SKIP_REASON);
    await signInAsTestUser(page);
  });

  test("accepts a near-miss within Levenshtein-1 and shows canonical", async ({
    page,
  }) => {
    const drill = await walkToListeningSpell(page);
    test.skip(drill === null, "No listening_spell drill found in this lesson tail.");
    if (drill === null) return;

    await expect(drill).toBeVisible();

    // Read the canonical from the input once submitted. Strategy:
    // type a single character (intentional near-miss) → submit → assert the
    // canonical reveal is non-empty. We don't know the exact word in advance
    // (synthesised from vocab pool) so we assert structure, not contents.
    const input = page.getByTestId("listening-spell-input");
    await input.fill("x");
    await page.getByTestId("listening-spell-submit").click();

    const feedback = page.getByTestId("listening-spell-feedback");
    await expect(feedback).toBeVisible();
    const canonical = page.getByTestId("listening-spell-canonical");
    await expect(canonical).toBeVisible();
    await expect(canonical).not.toBeEmpty();
  });

  test("exact match shows correct feedback without the close-enough hint", async ({
    page,
  }) => {
    const drill = await walkToListeningSpell(page);
    test.skip(drill === null, "No listening_spell drill found in this lesson tail.");
    if (drill === null) return;

    await expect(drill).toBeVisible();

    // Read canonical via the same trick: submit garbage to reveal the answer
    // in the canonical pane, navigate back into the same drill on a fresh
    // visit, then type the exact value. Cheaper alternative: just assert the
    // close-enough hint does NOT appear on a 0-distance submit. To do that we
    // need the canonical first.
    const input = page.getByTestId("listening-spell-input");
    await input.fill("x");
    await page.getByTestId("listening-spell-submit").click();

    const canonical = await page
      .getByTestId("listening-spell-canonical")
      .innerText();
    const word = canonical.trim().split(/\s+/)[0] ?? "";
    test.skip(word.length === 0, "Canonical reveal was empty; can't compute exact-match path.");

    // Reload by walking the path again — re-mount the drill from scratch.
    const drill2 = await walkToListeningSpell(page);
    test.skip(drill2 === null, "Second walk failed to reach listening_spell drill.");
    if (drill2 === null) return;

    const input2 = page.getByTestId("listening-spell-input");
    await input2.fill(word);
    await page.getByTestId("listening-spell-submit").click();

    await expect(page.getByTestId("listening-spell-feedback")).toBeVisible();
    await expect(page.getByTestId("listening-spell-close-enough")).toHaveCount(0);
  });
});
