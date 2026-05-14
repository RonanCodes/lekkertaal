/**
 * Playwright auth helper for signed-in e2e specs.
 *
 * Strategy (Option C from #93): rather than drive Clerk's hosted sign-in
 * flow (which is unreliable in headless Chromium against a `pk_test_` dev
 * instance because the dev-browser handshake never completes), we set a
 * shared-secret header on the BrowserContext. The server-side auth helper
 * sees the header in dev / preview / prod-with-secret builds and returns
 * the fixed seed user `seed_ronan` without invoking Clerk.
 *
 * Required env at test time:
 *   E2E_BYPASS_TOKEN: shared secret, also exported as a worker secret in
 *                     every environment we want to test against.
 *
 * Optional (legacy Clerk-testing path, no longer used by these specs):
 *   CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY, CLERK_TEST_USER_EMAIL
 *
 * The bypass is dead-code-eliminated from production worker bundles via
 * the `import.meta.env.DEV` gate in `src/lib/server/auth-helper.ts`, so the
 * header has no effect against a prod build. To run e2e against prod we
 * temporarily deploy a build where the dev gate is still live (or accept
 * that signed-in e2e runs target only dev/preview environments).
 *
 * See: docs/adr/0006-e2e-bypass-auth-header.md
 */

import type { Page } from "@playwright/test";

/** Header the server checks for the bypass shared secret. Keep in sync with auth-helper.ts. */
export const E2E_BYPASS_HEADER = "x-lekkertaal-e2e-bypass";

/** Fixed clerk-id the bypass resolves to. Matches `seed_ronan` in seed/users.json. */
export const TEST_USER_CLERK_ID = "seed_ronan";

/** Email reference kept for any legacy assertion that wants a display value. */
export const TEST_USER_EMAIL = process.env.CLERK_TEST_USER_EMAIL ?? "";

/** True when the env has the e2e bypass shared secret configured. */
export function isE2eBypassConfigured(): boolean {
  return Boolean(process.env.E2E_BYPASS_TOKEN);
}

/**
 * True when ANY signed-in flow is configured: the new header bypass OR
 * the legacy Clerk-testing path. Specs use this to decide whether to skip.
 */
export function isClerkTestingConfigured(): boolean {
  if (isE2eBypassConfigured()) return true;
  return Boolean(
    process.env.CLERK_SECRET_KEY &&
      (process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY) &&
      TEST_USER_EMAIL,
  );
}

/**
 * Set the bypass header on the playwright BrowserContext so every request
 * the page issues carries the shared secret. After this, navigations to
 * `/app/*` return the seed user as the authenticated principal.
 */
export async function signInViaBypass(page: Page): Promise<void> {
  const token = process.env.E2E_BYPASS_TOKEN;
  if (!token) {
    throw new Error(
      "E2E_BYPASS_TOKEN is not set. Add it to .dev.vars locally, or export it " +
        "in your shell, and ensure the matching value is set as a wrangler secret " +
        "in any deployed environment you plan to test against.",
    );
  }
  await page.context().setExtraHTTPHeaders({
    [E2E_BYPASS_HEADER]: token,
  });
}

/**
 * Backwards-compatible alias for the older Clerk-testing flow callsite.
 * New specs should call `signInViaBypass` directly.
 *
 * @deprecated Use `signInViaBypass` instead.
 */
export async function signInAsTestUser(page: Page): Promise<void> {
  await signInViaBypass(page);
}
