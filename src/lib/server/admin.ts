/**
 * Admin gating server fn.
 *
 * `assertAdmin` is a GET server fn that throws a redirect unless the caller is
 * an admin (see `requireAdminClerkId`). Used by admin-only route loaders such
 * as `/styleguide` (the design system), which must be reachable in production
 * by staff but bounce everyone else.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireAdminClerkId } from "./auth-helper";

export const assertAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminClerkId();
  return null;
});
