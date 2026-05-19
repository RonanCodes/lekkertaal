/**
 * E2E coverage for the Speaker "audio unavailable" info indicator (#139).
 *
 * When /api/tts returns a non-2xx response the Speaker component should
 * transition to the "unavailable" state and render an Info icon with a
 * tooltip instead of the volume button. This spec mocks the TTS endpoint
 * to return 500 on any request, navigates to a lesson that contains a
 * Speaker, triggers it, and asserts:
 *   - The Info icon (speaker-unavailable) is visible
 *   - No error toast leaks to the page
 *   - The tooltip is accessible via aria-label
 *
 * Skipped when E2E auth is not configured.
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";

const SKIP_REASON =
  "E2E auth bypass not configured. Set E2E_BYPASS_TOKEN locally (or as a " +
  "wrangler secret in deployed envs) to exercise the Speaker unavailable indicator.";

const MAX_HOPS = 40;

async function walkUntilSpeakerVisible(page: Page) {
  await page.goto("/app/path");

  const a2UnitLink = page.locator('a[href*="/app/unit/a2-unit-1"]').first();
  if ((await a2UnitLink.count()) === 0) return null;
  await a2UnitLink.click();
  await page.waitForURL(/\/app\/unit\//);

  const lessonLink = page.locator('a[href*="/app/lesson/"]').first();
  if ((await lessonLink.count()) === 0) return null;
  await lessonLink.click();
  await page.waitForURL(/\/app\/lesson\//);

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

test.describe("Speaker unavailable info indicator (#139)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), SKIP_REASON);
    await signInAsTestUser(page);
  });

  test("Info icon appears after TTS 500 and no error toast leaks", async ({ page }) => {
    // Route /api/tts to a 500 before navigating so any Speaker that fires
    // will see a failure.
    await page.route("**/api/tts**", (route) =>
      route.fulfill({ status: 500, body: "upstream error" }),
    );

    const speaker = await walkUntilSpeakerVisible(page);
    test.skip(speaker === null, "No Speaker found in this lesson.");
    if (speaker === null) return;

    await expect(speaker).toBeVisible();

    // The Speaker renders with text so it starts as idle (not unavailable).
    // We need to stub HTMLMediaElement so Audio fires onerror when src
    // pointing to the mocked 500 endpoint is loaded.
    await page.evaluate(() => {
      const proto = window.HTMLMediaElement.prototype;
      proto.play = async function play(this: HTMLMediaElement) {
        // Fire onerror to simulate the browser rejecting the audio src.
        setTimeout(() => {
          const ev = new Event("error");
          this.dispatchEvent(ev);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this as any).onerror?.(ev);
        }, 0);
        return undefined;
      };
    });

    // Click the main Speaker button to trigger play (and therefore the
    // simulated onerror).
    const playBtn = page.getByTestId("speaker-play").first();
    if ((await playBtn.count()) > 0) {
      await playBtn.click();
      // Wait for the state to transition to unavailable.
      await expect(speaker).toHaveAttribute("data-state", "unavailable", { timeout: 3000 });
    }

    // By this point the Speaker is in unavailable state. The Info icon
    // should be visible.
    const infoBtn = page.getByTestId("speaker-unavailable").first();
    await expect(infoBtn).toBeVisible();

    // The aria-label conveys the meaning to screen readers.
    await expect(infoBtn).toHaveAttribute("aria-label", "No audio available for this word.");

    // No toast / error banner should be present on the page. Toast
    // elements in this app have role="status" or data-testid="toast".
    const toastCount = await page.getByRole("status").count();
    // We allow zero or at most one generic status region (the lesson
    // progress bar can carry role="status"). We just assert no explicit
    // toast text about "audio failed" is visible.
    const audioErrorVisible = await page
      .getByText(/audio failed|tts error|playback error/i)
      .isVisible()
      .catch(() => false);
    expect(audioErrorVisible).toBe(false);

    // Tooltip is accessible: clicking the Info button reveals it.
    await infoBtn.click();
    const tooltip = page.getByTestId("speaker-unavailable-tooltip").first();
    await expect(tooltip).toHaveClass(/opacity-100/);

    // Sanity: toast count is still the same (no new error toasts).
    expect(await page.getByRole("status").count()).toBe(toastCount);
  });
});
