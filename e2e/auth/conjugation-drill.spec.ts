/**
 * E2E coverage for the conjugation drill (US-006 / PR #148).
 *
 * Renders an infinitive + tense header and six text inputs for each Dutch
 * person (ik / jij / hij_zij / wij / jullie / zij). Each cell grades
 * independently (literal equality on trim+lowercase) and exposes its result
 * via a `data-correct="true|false"` attribute on the cell label.
 *
 * The drill ships in `a2-unit-1-werkwoorden-hebben-zijn`. The first seeded
 * verb is `hebben` in present tense — its forms are deterministic, so the
 * specs can hard-code them.
 *
 * Skipped when the e2e bypass header is not configured or when the
 * skip-loop can't reach a conjugation drill.
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";

const SKIP_REASON =
  "E2E auth bypass not configured. Set E2E_BYPASS_TOKEN locally (or as a " +
  "wrangler secret in deployed envs) to exercise the conjugation drill.";

const MAX_HOPS = 40;

// hebben, present tense — matches seed entry `conj-pres-hebben`.
const PERSONS = ["ik", "jij", "hij_zij", "wij", "jullie", "zij"] as const;
type Person = (typeof PERSONS)[number];

const HEBBEN_FORMS: Record<Person, string> = {
  ik: "heb",
  jij: "hebt",
  hij_zij: "heeft",
  wij: "hebben",
  jullie: "hebben",
  zij: "hebben",
};

async function walkToConjugation(page: Page) {
  await page.goto("/app/path");

  const a2UnitLink = page.locator('a[href*="/app/unit/a2-unit-1"]').first();
  if ((await a2UnitLink.count()) === 0) return null;
  await a2UnitLink.click();
  await page.waitForURL(/\/app\/unit\//);

  const lessonLink = page.locator('a[href*="/app/lesson/"]').first();
  if ((await lessonLink.count()) === 0) return null;
  await lessonLink.click();
  await page.waitForURL(/\/app\/lesson\//);

  const drill = page.getByTestId("conjugation-drill");
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

/**
 * Read the displayed infinitive from the conjugation card. Lets the spec
 * skip cleanly when the first conjugation drill it hits isn't `hebben` (e.g.
 * the lesson player happens to surface `zijn` first).
 */
async function readInfinitive(page: Page): Promise<string> {
  const heading = await page
    .getByTestId("conjugation-drill")
    .locator("div", { hasText: /—/ })
    .first()
    .innerText();
  return heading.split("—")[0]?.trim().toLowerCase() ?? "";
}

test.describe("Conjugation drill (US-006)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), SKIP_REASON);
    await signInAsTestUser(page);
  });

  test("all-correct fill marks every cell green and advances", async ({ page }) => {
    const drill = await walkToConjugation(page);
    test.skip(drill === null, "No conjugation drill found in this lesson tail.");
    if (drill === null) return;

    await expect(drill).toBeVisible();

    const infinitive = await readInfinitive(page);
    test.skip(
      infinitive !== "hebben",
      `Conjugation drill surfaced ${infinitive}, not hebben — skipping deterministic fill.`,
    );

    for (const key of PERSONS) {
      await page.getByTestId(`conjugation-input-${key}`).fill(HEBBEN_FORMS[key]);
    }
    await page.getByTestId("conjugation-submit").click();

    // Every cell must report data-correct="true".
    for (const key of PERSONS) {
      const cell = page.getByTestId(`conjugation-cell-${key}`);
      await expect(cell).toHaveAttribute("data-correct", "true");
    }

    const continueBtn = page.getByTestId("conjugation-continue");
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();

    // Lesson player advances — the conjugation drill should no longer be
    // visible. Either another drill renders, or the lesson-complete screen.
    await expect(page.getByTestId("conjugation-drill")).toHaveCount(0);
  });

  test("mixed correct/wrong fill marks cells red/green and still advances", async ({
    page,
  }) => {
    const drill = await walkToConjugation(page);
    test.skip(drill === null, "No conjugation drill found in this lesson tail.");
    if (drill === null) return;

    await expect(drill).toBeVisible();

    const infinitive = await readInfinitive(page);
    test.skip(
      infinitive !== "hebben",
      `Conjugation drill surfaced ${infinitive}, not hebben — skipping deterministic fill.`,
    );

    // 4 correct + 2 wrong (jij, hij_zij swapped for garbage).
    const wrong: Record<Person, string> = {
      ...HEBBEN_FORMS,
      jij: "habt",
      hij_zij: "haaft",
    };
    for (const key of PERSONS) {
      await page.getByTestId(`conjugation-input-${key}`).fill(wrong[key]);
    }
    await page.getByTestId("conjugation-submit").click();

    // Wrong cells: data-correct="false". Correct cells: "true".
    await expect(page.getByTestId("conjugation-cell-jij")).toHaveAttribute(
      "data-correct",
      "false",
    );
    await expect(page.getByTestId("conjugation-cell-hij_zij")).toHaveAttribute(
      "data-correct",
      "false",
    );
    await expect(page.getByTestId("conjugation-cell-ik")).toHaveAttribute(
      "data-correct",
      "true",
    );
    await expect(page.getByTestId("conjugation-cell-wij")).toHaveAttribute(
      "data-correct",
      "true",
    );

    const continueBtn = page.getByTestId("conjugation-continue");
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();
    await expect(page.getByTestId("conjugation-drill")).toHaveCount(0);
  });
});
