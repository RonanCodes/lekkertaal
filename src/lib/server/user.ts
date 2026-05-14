/**
 * Server-side helpers for accessing/updating the current user row.
 * Always require an authenticated Clerk session; throw otherwise.
 */
import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/client";
import { users, userUnitProgress, units } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";
import { DEV_BYPASS_CLERK_ID, requireUserClerkId, tryGetUserClerkId } from "./auth-helper";
import { resetUserData } from "./reset-user-data";

/**
 * SSR-friendly auth probe used by the root route loader.
 *
 * Returns the effective auth state including the user's display_name, so the
 * header `<AuthNav>` can render the signed-in branch on the first SSR pass
 * even when Clerk's client `useAuth()` would say signed-out (the
 * `DEV_BYPASS_AUTH` and e2e-header bypass paths in `auth-helper.ts`).
 *
 * `isBypass` tells the client whether we got here via a dev bypass so the
 * UI can render a small "dev: <name>" indicator instead of Clerk's
 * `<UserButton/>` (Clerk has no session in that path).
 */
export const getEffectiveAuth = createServerFn({ method: "GET" }).handler(async () => {
  const clerkId = await tryGetUserClerkId();
  if (!clerkId) {
    return { userId: null, displayName: null, isBypass: false } as const;
  }
  const isBypass = clerkId === DEV_BYPASS_CLERK_ID;
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const rows = await drz
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  const row = rows[0];
  return {
    userId: row ? String(row.id) : clerkId,
    displayName: row?.displayName ?? null,
    isBypass,
  } as const;
});

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const clerkId = await requireUserClerkId();
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const rows = await drz.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return rows[0] ?? null;
});

export const setCefrLevel = createServerFn({ method: "POST" })
  .inputValidator((input: { level: "A1" | "A2" | "B1"; placementScore?: number }) => input)
  .handler(async ({ data }) => {
    const clerkId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    await drz
      .update(users)
      .set({
        cefrLevel: data.level,
        onboardedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.clerkId, clerkId));
    return { ok: true };
  });

export const setReminderPrefs = createServerFn({ method: "POST" })
  .inputValidator((input: { hour: number; enabled: boolean; timezone?: string }) => input)
  .handler(async ({ data }) => {
    const clerkId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    await drz
      .update(users)
      .set({
        reminderHour: data.hour,
        reminderEnabled: data.enabled,
        timezone: data.timezone ?? "Europe/Amsterdam",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.clerkId, clerkId));
    return { ok: true };
  });

/**
 * "Reset my learning data" entry point — wired to the profile-page button.
 *
 * Deletes every user-scoped row across progress / engagement / social tables
 * and resets the aggregate columns on the user's row. The Clerk account
 * itself stays; the caller remains signed in and is redirected to `/app/path`,
 * which re-seeds the starting unit via `unlockStartingUnit`.
 */
export const resetMyData = createServerFn({ method: "POST" }).handler(async () => {
  const clerkId = await requireUserClerkId();
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const me = await drz
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!me[0]) throw new Error("User row missing");
  const result = await resetUserData(drz, me[0].id);
  return { ok: true, cleared: result.cleared };
});

/** Unlock the first unit of the user's CEFR level. Idempotent. */
export const unlockStartingUnit = createServerFn({ method: "POST" }).handler(async () => {
  const clerkId = await requireUserClerkId();
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const me = await drz.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me[0]) throw new Error("User row missing");
  const firstUnit = await drz
    .select()
    .from(units)
    .where(eq(units.cefrLevel, me[0].cefrLevel))
    .orderBy(units.order)
    .limit(1);
  if (!firstUnit[0]) return { ok: false, reason: "no units" };
  const existing = await drz
    .select()
    .from(userUnitProgress)
    .where(and(eq(userUnitProgress.userId, me[0].id), eq(userUnitProgress.unitId, firstUnit[0].id)))
    .limit(1);
  if (existing.length === 0) {
    await drz.insert(userUnitProgress).values({
      userId: me[0].id,
      unitId: firstUnit[0].id,
      status: "unlocked",
      startedAt: new Date().toISOString(),
    });
  }
  return { ok: true, unitSlug: firstUnit[0].slug };
});
