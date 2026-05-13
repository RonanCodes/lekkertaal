/**
 * Server-side helpers for accessing/updating the current user row.
 * Always require an authenticated Clerk session; throw otherwise.
 */
import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/client";
import { users, userUnitProgress, units } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";
import { requireUserClerkId } from "./auth-helper";

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
