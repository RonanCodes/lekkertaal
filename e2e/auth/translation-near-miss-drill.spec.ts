/**
 * E2E coverage for the translation_typing drill (US-003 / PR #144).
 *
 * Sentence-translation drills accept a Levenshtein-3 tolerance on the
 * normalised input. When the user is correct but off by 1-3 chars, a
 * "Close enough" hint surfaces alongside the canonical answer.
 *
 * The drill exposes a `data-canonical-answer` attribute on its root for the
 * sole purpose of letting Playwright compute exact-match input — the attr
 * is never rendered visually, so it has no learner-facing effect.
 *
 * Walks into a2-unit-1 (which carries translation_typing seeds in
 * `a2-unit-1-werkwoorden-hebben-zijn`) and skips drills until a
 * translation-typing-drill testid appears. Caps hops so a missing drill
 * doesn't hang the run.
 *
 * Skipped when the e2e bypass header is not configured.
 */

import { test, expect } from "@playwright/test";
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";
import { walkToDrill } from "../setup/lesson-nav";

const SKIP_REASON =
  "E2E auth bypass not configured. Set E2E_BYPASS_TOKEN locally (or as a " +
  "wrangler secret in deployed envs) to exercise the translation-typing drill.";

test.describe("Translation-typing drill (US-003)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), SKIP_REASON);
    await signInAsTestUser(page);
  });

  test("near-miss within Levenshtein-3 surfaces the 'Close enough' hint", async ({
    page,
  }) => {
    const drill = await walkToDrill(page, { drillTestId: "translation-typing-drill" });
    test.skip(drill === null, "No translation_typing drill found in this lesson.");
    if (drill === null) return;

    await expect(drill).toBeVisible();

    // Pull the canonical from the e2e-only data attr; pick the first
    // pipe-separated form (the drill accepts a `|`-joined alt list).
    const canonicalRaw = (await drill.getAttribute("data-canonical-answer")) ?? "";
    const canonical = canonicalRaw.split("|")[0]?.trim() ?? "";
    test.skip(canonical.length < 2, "Canonical too short to compute a near-miss.");

    // Build a deliberate 1-char near-miss: swap the last character for "x".
    // This guarantees distance == 1 against the canonical, well inside the
    // Levenshtein-3 tolerance.
    const nearMiss = canonical.slice(0, -1) + (canonical.endsWith("x") ? "y" : "x");

    const input = page.getByTestId("translation-typing-input");
    await input.fill(nearMiss);
    await page.getByTestId("translation-typing-submit").click();

    const feedback = page.getByTestId("translation-typing-feedback");
    await expect(feedback).toBeVisible();
    await expect(page.getByTestId("translation-typing-close-enough")).toBeVisible();
  });

  test("exact match grades correct WITHOUT the close-enough hint", async ({
    page,
  }) => {
    const drill = await walkToDrill(page, { drillTestId: "translation-typing-drill" });
    test.skip(drill === null, "No translation_typing drill found in this lesson.");
    if (drill === null) return;

    await expect(drill).toBeVisible();

    const canonicalRaw = (await drill.getAttribute("data-canonical-answer")) ?? "";
    const canonical = canonicalRaw.split("|")[0]?.trim() ?? "";
    test.skip(canonical.length === 0, "Canonical reveal was empty; can't compute exact-match path.");

    const input = page.getByTestId("translation-typing-input");
    await input.fill(canonical);
    await page.getByTestId("translation-typing-submit").click();

    await expect(page.getByTestId("translation-typing-feedback")).toBeVisible();
    await expect(page.getByTestId("translation-typing-close-enough")).toHaveCount(0);
  });
});
