/**
 * Clerk testing helper for Playwright signed-in e2e tests.
 *
 * Wraps `@clerk/testing/playwright` so individual specs can call one function
 * to (a) bypass bot protection and (b) sign in as the configured test user.
 *
 * Test-user strategy
 * ------------------
 * We expect a pre-existing Clerk dev-instance user whose email address is
 * supplied via `CLERK_TEST_USER_EMAIL`. Use an email of the form
 * `your_email+clerk_test@example.com` so Clerk treats it as a test fixture
 * (no real email is sent). Create the user once in the Clerk dashboard for
 * the lekkertaal dev instance, then export the env var:
 *
 *     export CLERK_TEST_USER_EMAIL=lekkertaal+clerk_test@example.com
 *
 * Required env vars at test time:
 *   CLERK_SECRET_KEY            — dev-instance secret (sk_test_...)
 *   VITE_CLERK_PUBLISHABLE_KEY  — dev-instance publishable (pk_test_...)
 *   CLERK_TEST_USER_EMAIL       — email of the pre-seeded Clerk test user
 *
 * The publishable key is also re-exported as `CLERK_PUBLISHABLE_KEY` so
 * `@clerk/testing` picks it up regardless of which name it looks for.
 *
 * Alternative (not used here): create the user on the fly via the Clerk
 * Backend API. Skipped because tests then mutate the Clerk instance, which
 * is messy in CI and pointless when a single fixture user is enough.
 */

import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import type { BrowserContext, Page } from "@playwright/test";

let clerkSetupDone = false;

export const TEST_USER_EMAIL = process.env.CLERK_TEST_USER_EMAIL ?? "";

/** True when the env has everything we need to run signed-in tests. */
export function isClerkTestingConfigured(): boolean {
  return Boolean(
    process.env.CLERK_SECRET_KEY &&
      (process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY) &&
      TEST_USER_EMAIL,
  );
}

/**
 * Fetch a fresh testing token from the Clerk Backend API. Cheap to call
 * repeatedly because we cache the first success per process.
 */
async function ensureClerkSetup(): Promise<void> {
  if (clerkSetupDone) return;
  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY;
  await clerkSetup({ publishableKey });
  clerkSetupDone = true;
}

/**
 * Attach the Clerk testing token to a Playwright context so requests skip
 * bot protection. Use when you only need the token (e.g. visiting public
 * pages while keeping Clerk happy).
 */
export async function attachTestingToken(context: BrowserContext): Promise<void> {
  await ensureClerkSetup();
  await setupClerkTestingToken({ context });
}

/**
 * Full signed-in setup: token + ticket-based sign-in as the configured test
 * user. After this resolves, `page` has an authenticated Clerk session and
 * may navigate to `/app/*` routes.
 */
export async function signInAsTestUser(page: Page): Promise<void> {
  if (!isClerkTestingConfigured()) {
    throw new Error(
      "Clerk testing env not configured. Set CLERK_SECRET_KEY, " +
        "VITE_CLERK_PUBLISHABLE_KEY (or CLERK_PUBLISHABLE_KEY), and " +
        "CLERK_TEST_USER_EMAIL before running signed-in e2e tests.",
    );
  }
  await ensureClerkSetup();
  // Attach the testing token at the CONTEXT level BEFORE the first navigation
  // so it covers every request Clerk makes. (Pure page-level attachment
  // misses the dev-browser handshake.)
  await setupClerkTestingToken({ context: page.context() });
  // Navigate to /sign-in (not "/") so <SignIn/> mounts and the Clerk SDK
  // loads. The landing page only ships <SignedIn/> sentinels and never
  // triggers Clerk to bootstrap.
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
}
