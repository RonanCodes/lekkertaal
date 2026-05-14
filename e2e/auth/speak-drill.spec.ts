/**
 * Speak-drill e2e (P2-STT-3 #56).
 *
 * Auth-gated end-to-end walk through the speak-drill flow. We can't drive a
 * real microphone in headless Chromium, so the test uses the upload fallback
 * (visible whenever MediaRecorder reports unavailable) and mocks the three
 * STT endpoints to return deterministic shapes:
 *
 *   - /api/stt/transcribe → fake transcript + audioKey
 *   - /api/stt/score      → high score + per-token diff
 *   - /api/stt/speak-complete → passed + xpAwarded
 *
 * The fixture audio (`e2e/fixtures/speak-clip.webm`) is not actually decoded
 * because the route handlers are intercepted before they ever leave the
 * browser. Its only job is to populate the <input type="file"> control.
 *
 * Skipped when Clerk testing env is missing so unattended CI runs don't fail
 * on missing credentials.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isClerkTestingConfigured, signInAsTestUser } from "../setup/clerk-auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_AUDIO = path.resolve(__dirname, "..", "fixtures", "speak-clip.webm");

const skipReason =
  "Clerk testing env missing. Set CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY, " +
  "and CLERK_TEST_USER_EMAIL to run the speak-drill flow.";

test.describe("Speak drill flow", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isClerkTestingConfigured(), skipReason);
    await signInAsTestUser(page);

    // Mock STT endpoints. Pass-grade response with one perfect token so the
    // assertion is unambiguous.
    await page.route("**/api/stt/transcribe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          transcript: "Goedemorgen",
          audioKey: "stt/test/fake.webm",
          durationMs: 1500,
        }),
      });
    });
    await page.route("**/api/stt/score", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          score: 92,
          tokens: [
            { word: "goedemorgen", status: "match" },
          ],
        }),
      });
    });
    await page.route("**/api/stt/speak-complete", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ passed: true, xpAwarded: 5, alreadyAwarded: false }),
      });
    });
  });

  test("upload-fallback path scores a clip + awards XP", async ({ page }) => {
    // Strip MediaRecorder before any drill component mounts so the SpeakDrill
    // takes the upload-only branch. The fallback is what the spec stresses.
    await page.addInitScript(() => {
      delete (window as unknown as { MediaRecorder?: unknown }).MediaRecorder;
    });

    // Navigate to a unit known to contain speak drills (a1-01-greetings has
    // 2+ speak drills via the curriculum seed). The lesson queue is ordered
    // by exercise id, so the speak drills surface after the typing ones.
    await page.goto("/app/unit/a1-01-greetings", { waitUntil: "domcontentloaded" });

    // Click into lesson 1.
    const lessonLink = page.locator('a[href*="/app/lesson/"]').first();
    await expect(lessonLink).toBeVisible({ timeout: 10_000 });
    await lessonLink.click();
    await page.waitForURL(/\/app\/lesson\//);

    // Walk forward until we land on a speak drill (identified by the
    // `data-testid="speak-drill"` mount point). We bail after a sane cap
    // so a missing speak drill doesn't hang the test.
    const speakDrill = page.getByTestId("speak-drill");
    for (let i = 0; i < 20; i++) {
      if (await speakDrill.isVisible().catch(() => false)) break;
      // Best-effort: skip the current drill by submitting whatever default
      // answer the drill accepts. The lesson player auto-advances on submit.
      const skipBtn = page.getByRole("button", { name: /skip|check|continue/i }).first();
      if (await skipBtn.isVisible().catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(400);
      } else {
        break;
      }
    }

    await expect(speakDrill).toBeVisible();
    await expect(page.getByTestId("speak-upload-input")).toBeAttached();

    // Drive the upload-fallback path.
    await page
      .getByTestId("speak-upload-input")
      .setInputFiles(FIXTURE_AUDIO);

    // Mocked scoring should land quickly.
    await expect(page.getByTestId("speak-score")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("speak-score")).toHaveText("92");
    await expect(page.getByTestId("speak-tokens")).toBeVisible();
    await expect(page.getByTestId("speak-xp")).toHaveText(/\+5 XP/);
  });
});
