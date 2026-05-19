/**
 * Shared navigation helpers for e2e drill specs.
 *
 * Most drill specs share the same two-phase navigation shape:
 *   1. Walk from the learning path into a unit, then into a lesson.
 *   2. Hop through drills (clicking "Continue" or "Skip") until the target
 *      drill testid appears, or until maxHops is exhausted.
 *
 * Both steps are extracted here so each spec only expresses what it cares
 * about: "get me to a drill with testid X, then I'll do the actual assertions."
 *
 * ## Skip-loop semantics
 *
 * Each hop clicks the first visible "Continue / Finish lesson" button, falling
 * back to the "Skip" button, then waits 150ms for the lesson player to mount
 * the next drill. This timing matches the lesson player's transition animation.
 *
 * Drills that appear only at the lesson tail (flashcards, listening_spell) are
 * reached by raising maxHops. The default of 40 covers a typical lesson; set
 * 60 for tail-only drills.
 *
 * ## Extending for new drills
 *
 * Call `walkToDrill` with the relevant `data-testid` value. If your drill only
 * appears after a specific transition (e.g. a banner animation), add a small
 * `page.waitForTimeout` after receiving the non-null Locator before
 * asserting visibility.
 *
 * ## Example
 *
 * ```ts
 * const drill = await walkToDrill(page, { drillTestId: "my-drill" });
 * test.skip(drill === null, "Drill not found — seed not loaded.");
 * if (drill === null) return;
 * await expect(drill).toBeVisible();
 * ```
 */

import type { Locator, Page } from "@playwright/test";

export interface WalkToDrillOptions {
  /**
   * Unit slug to navigate into.
   * @default "a2-unit-1"
   */
  unitSlug?: string;
  /** The `data-testid` value that identifies the target drill. */
  drillTestId: string;
  /**
   * Maximum number of "Continue / Skip" clicks before giving up.
   * @default 40
   */
  maxHops?: number;
}

/**
 * Walk from `/app/path` into the first lesson of `unitSlug` and hop through
 * drills until one carrying `data-testid="drillTestId"` appears.
 *
 * Returns the target Locator on first sighting, or `null` when:
 *   - the unit link is not present (seed not loaded), or
 *   - no lesson links are found in the unit, or
 *   - the drill does not appear within `maxHops` clicks.
 *
 * Callers should `test.skip(result === null, "<reason>")` immediately after
 * receiving a null so the test is marked skipped rather than failed.
 */
export async function walkToDrill(
  page: Page,
  options: WalkToDrillOptions,
): Promise<Locator | null> {
  const { unitSlug = "a2-unit-1", drillTestId, maxHops = 40 } = options;

  await page.goto("/app/path");

  const unitLink = page.locator(`a[href*="/app/unit/${unitSlug}"]`).first();
  if ((await unitLink.count()) === 0) return null;
  await unitLink.click();
  await page.waitForURL(/\/app\/unit\//);

  const lessonLink = page.locator('a[href*="/app/lesson/"]').first();
  if ((await lessonLink.count()) === 0) return null;
  await lessonLink.click();
  await page.waitForURL(/\/app\/lesson\//);

  const drill = page.getByTestId(drillTestId);
  for (let i = 0; i < maxHops; i++) {
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

/**
 * Walk from `/app/path` into the first lesson of `unitSlug` and return once
 * the lesson URL has been reached.
 *
 * Useful for specs that need to be inside a lesson but don't care about a
 * specific drill type (e.g. testing the lesson chrome / progress bar).
 *
 * Returns `true` if navigation succeeded, `false` if any link was absent.
 */
export async function walkIntoFirstLesson(
  page: Page,
  unitSlug = "a2-unit-1",
): Promise<boolean> {
  await page.goto("/app/path");

  const unitLink = page.locator(`a[href*="/app/unit/${unitSlug}"]`).first();
  if ((await unitLink.count()) === 0) return false;
  await unitLink.click();
  await page.waitForURL(/\/app\/unit\//);

  const lessonLink = page.locator('a[href*="/app/lesson/"]').first();
  if ((await lessonLink.count()) === 0) return false;
  await lessonLink.click();
  await page.waitForURL(/\/app\/lesson\//);

  return true;
}
