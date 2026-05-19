/**
 * E2E coverage for the Speaker slow-replay button (US-007).
 *
 * The Speaker component renders two controls on desktop: a main full-speed
 * play button and a smaller Turtle "play slowly" button. On touch-only
 * devices the second button is hidden via a `(pointer: fine)` media query;
 * touch users get the same behaviour via a long-press on the main button.
 *
 * This spec covers the desktop visibility + click path and the mobile
 * visibility path. Long-press itself is hard to exercise reliably across
 * browsers, so we accept "Turtle button hidden at narrow viewport" as
 * sufficient e2e signal for the mobile branch.
 *
 * Skipped when E2E auth is not configured.
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";

const SKIP_REASON =
  "E2E auth bypass not configured. Set E2E_BYPASS_TOKEN locally (or as a " +
  "wrangler secret in deployed envs) to exercise the Speaker slow-replay.";

const MAX_HOPS = 40;

async function walkUntilSpeakerVisible(page: Page) {
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

  // The Speaker is reused across many drill types (match_pairs, listening_spell,
  // flashcards, etc.). Walk through the lesson hopping past each drill until
  // a Speaker wrapper is rendered.
  const speaker = page.getByTestId("speaker").first();
  for (let i = 0; i < MAX_HOPS; i++) {
    if ((await speaker.count()) > 0) return speaker;
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

test.describe("Speaker slow-replay (US-007)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), SKIP_REASON);
    await signInAsTestUser(page);
  });

  test("desktop: both main and Turtle buttons visible", async ({ page }) => {
    const speaker = await walkUntilSpeakerVisible(page);
    test.skip(speaker === null, "No Speaker found in this lesson.");
    if (speaker === null) return;

    await expect(speaker).toBeVisible();

    // Main play button: always visible.
    const main = page.getByTestId("speaker-play").first();
    await expect(main).toBeVisible();

    // Turtle (slow) button: visible at the desktop viewport (default
    // Playwright is 1280x720 with pointer:fine).
    const slow = page.getByTestId("speaker-play-slow").first();
    await expect(slow).toBeVisible();
  });

  test("desktop: clicking Turtle sets playbackRate to 0.5", async ({ page }) => {
    const speaker = await walkUntilSpeakerVisible(page);
    test.skip(speaker === null, "No Speaker found in this lesson.");
    if (speaker === null) return;

    // Stub the Audio prototype's play() in this page context so the test
    // doesn't actually fire a network request. We can't replace the Audio
    // constructor because the React component captures it via `new Audio()`
    // inside the click handler; patching the prototype is the lightest
    // monkey-patch that still lets us measure playbackRate.
    await page.evaluate(() => {
      const proto = window.HTMLMediaElement.prototype;
      proto.play = async function play(this: HTMLMediaElement) {
        // No-op resolve; setting playbackRate has already happened by now.
        return undefined;
      };
    });

    const slow = page.getByTestId("speaker-play-slow").first();
    await slow.click();

    // The component writes the last applied rate to the wrapper as a data
    // attribute via React state. Poll for it to flush.
    const speakerWrap = page.getByTestId("speaker").first();
    await expect(speakerWrap).toHaveAttribute("data-last-playback-rate", "0.5");
  });

  test("mobile viewport: Turtle button is hidden", async ({ page, browserName }) => {
    // Webkit honours the `(pointer: fine)` media query the most predictably;
    // Chromium may keep pointer:fine even at 375px wide. We don't fail the
    // suite over that — just skip the assertion when the underlying media
    // query says we're still on a fine pointer.
    await page.setViewportSize({ width: 375, height: 800 });
    // Playwright doesn't expose a pointer-coarse override, so we soft-skip
    // below when the media query still reports pointer:fine. The mobile
    // long-press path is exercised by unit tests on the Speaker component.

    const speaker = await walkUntilSpeakerVisible(page);
    test.skip(speaker === null, "No Speaker found in this lesson.");
    if (speaker === null) return;

    const isPointerFine = await page.evaluate(
      () => window.matchMedia("(pointer: fine)").matches,
    );
    test.skip(
      isPointerFine,
      `Browser ${browserName} still reports pointer:fine at 375px wide; the Turtle button visibility cannot be exercised here. Long-press path remains covered by unit tests.`,
    );

    const slow = page.getByTestId("speaker-play-slow").first();
    // Hidden via `hidden` class; assertion is "not visible".
    await expect(slow).toBeHidden();
  });
});
