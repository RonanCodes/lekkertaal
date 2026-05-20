/**
 * E2E coverage for the /styleguide dev-only branding showcase (GH #186).
 *
 * The route is gated by `import.meta.env.DEV` — in production builds it
 * redirects to `/` before rendering. In the dev server used by Playwright
 * the gate is open, so we can navigate directly.
 *
 * Auth bypass: the route itself does not require a Clerk session (it only
 * checks the DEV env flag), but we sign in via the e2e bypass header anyway
 * so the AppShell (if it wraps the page in future) does not redirect us.
 * The spec falls back gracefully when the bypass token is not configured.
 *
 * Assertions:
 *   - /styleguide responds without redirect (URL stays on /styleguide).
 *   - The treat gallery container is present and contains >=8 treat images.
 *   - The palette panels container is present and contains >=3 palette items.
 */
import { test, expect } from "@playwright/test";
import { isE2eBypassConfigured, E2E_BYPASS_HEADER } from "../setup/clerk-auth";

const SKIP_REASON =
  "E2E bypass not configured — set E2E_BYPASS_TOKEN. " +
  "/styleguide is dev-only so this spec only runs against a local dev server.";

test.describe("/styleguide branding showcase", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isE2eBypassConfigured(), SKIP_REASON);

    // Set the bypass header on all requests from this context.
    const token = process.env.E2E_BYPASS_TOKEN!;
    await page.setExtraHTTPHeaders({ [E2E_BYPASS_HEADER]: token });
  });

  test("renders without redirect", async ({ page }) => {
    await page.goto("/styleguide", { waitUntil: "domcontentloaded" });

    // Must stay on /styleguide (not redirected to / or /sign-in).
    expect(page.url()).toContain("/styleguide");
    expect(page.url()).not.toContain("/sign-in");
  });

  test("renders the treat gallery with >=8 treat images", async ({ page }) => {
    await page.goto("/styleguide", { waitUntil: "domcontentloaded" });

    const gallery = page.getByTestId("treat-gallery");
    await expect(gallery).toBeVisible();

    // Each treat has an <img> for the active expression frame.
    const images = gallery.locator("img");
    const count = await images.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test("renders the palette panels with >=3 panels", async ({ page }) => {
    await page.goto("/styleguide", { waitUntil: "domcontentloaded" });

    const panels = page.getByTestId("palette-panels");
    await expect(panels).toBeVisible();

    // Each palette renders inside a .palette-<name> div with a swatch header.
    const paletteDivs = panels.locator("[class^='palette-']");
    const count = await paletteDivs.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("switching expression changes the displayed images", async ({ page }) => {
    await page.goto("/styleguide", { waitUntil: "domcontentloaded" });

    // The first image should use the idle expression by default.
    const firstImg = page.getByTestId("treat-gallery").locator("img").first();
    const idleSrc = await firstImg.getAttribute("src");
    expect(idleSrc).toContain("/idle.png");

    // Click the happy expression picker button.
    await page.getByRole("button", { name: /happy/i }).click();

    const happySrc = await firstImg.getAttribute("src");
    expect(happySrc).toContain("/happy.png");

    // Switch to surprised.
    await page.getByRole("button", { name: /surprised/i }).click();

    const surprisedSrc = await firstImg.getAttribute("src");
    expect(surprisedSrc).toContain("/surprised.png");
  });
});
