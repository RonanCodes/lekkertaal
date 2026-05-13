/**
 * SM-2 spaced repetition engine.
 *
 * Two public server fns:
 * - getDueReviews(): returns up to 3 due cards for the current user; called by
 *   the lesson loader so the player surfaces a "Review" section before new
 *   content (acceptance criterion 2).
 * - recordReviewResult({ queueId, correct }): SM-2 update.
 *
 * Two internal helpers exported for other server modules to call:
 * - enqueueRoleplayErrors(userId, errors): called from gradeRoleplaySession.
 * - enqueueDrillMistake(userId, exerciseId, payload): called from
 *   recordDrillResult on incorrect answers.
 *
 * Cap: max 10 active review items per user (acceptance 5). Oldest-but-not-due
 * items are evicted past the cap so we don't crowd out new errors.
 */
import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/client";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { users, spacedRepQueue } from "../../db/schema";
import { and, asc, eq, lte, sql, desc } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";

const MAX_ACTIVE_REVIEWS = 10;
const DUE_BATCH = 3;

export type ReviewCard = {
  id: number;
  itemType: string;
  itemKey: string;
  payload: Record<string, unknown> | null;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewDate: string;
};

function todayIso(): string {
  return new Date().toISOString();
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Read current user id (clerkId -> users.id) or throw redirect. */
async function currentUserId(drz: ReturnType<typeof db>): Promise<number> {
  const a = await auth();
  if (!a.userId) throw redirect({ to: "/sign-in" });
  const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
  if (!me[0]) throw new Error("User row missing");
  return me[0].id;
}

/** Insert or upsert one review-queue row, respecting the per-user cap. */
async function upsertQueueRow(
  drz: DrizzleD1Database,
  row: {
    userId: number;
    itemType: string;
    itemKey: string;
    payload: Record<string, unknown> | null;
  },
) {
  // If a row with the same (userId, itemType, itemKey) exists, reset its
  // review schedule to "due today" so the error resurfaces.
  const existing = await drz
    .select()
    .from(spacedRepQueue)
    .where(
      and(
        eq(spacedRepQueue.userId, row.userId),
        eq(spacedRepQueue.itemType, row.itemType),
        eq(spacedRepQueue.itemKey, row.itemKey),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await drz
      .update(spacedRepQueue)
      .set({
        payload: row.payload,
        // Bump back to "due today" but keep accumulated ease so a frequently-
        // missed concept still resurfaces aggressively.
        nextReviewDate: todayIso(),
        easeFactor: Math.max(1.3, existing[0].easeFactor - 0.2),
      })
      .where(eq(spacedRepQueue.id, existing[0].id));
    return;
  }

  // Cap check: count existing non-graduated rows for the user. Graduated
  // here means easeFactor unchanged AND intervalDays > 21 (it's basically
  // permanent recall). Cap counts everything else as "active".
  const activeCount = await drz
    .select({ c: sql<number>`count(*)` })
    .from(spacedRepQueue)
    .where(eq(spacedRepQueue.userId, row.userId));

  if ((activeCount[0]?.c ?? 0) >= MAX_ACTIVE_REVIEWS) {
    // Evict the oldest row whose next review is furthest out (least urgent).
    const oldest = await drz
      .select()
      .from(spacedRepQueue)
      .where(eq(spacedRepQueue.userId, row.userId))
      .orderBy(desc(spacedRepQueue.nextReviewDate))
      .limit(1);
    if (oldest[0]) {
      await drz.delete(spacedRepQueue).where(eq(spacedRepQueue.id, oldest[0].id));
    }
  }

  await drz.insert(spacedRepQueue).values({
    userId: row.userId,
    itemType: row.itemType,
    itemKey: row.itemKey,
    payload: row.payload,
    nextReviewDate: todayIso(),
    easeFactor: 2.5,
    intervalDays: 1,
    repetitions: 0,
  });
}

/** Called from gradeRoleplaySession after errors are inserted. */
export async function enqueueRoleplayErrors(
  drz: DrizzleD1Database,
  userId: number,
  errors: Array<{
    sessionId: number;
    errorId: number;
    category: string;
    incorrect: string;
    correction: string;
    explanationEn?: string | null;
  }>,
): Promise<void> {
  for (const e of errors) {
    await upsertQueueRow(drz, {
      userId,
      itemType: "roleplay_error",
      itemKey: `${e.category}:${e.incorrect.toLowerCase()}`,
      payload: {
        sessionId: e.sessionId,
        errorId: e.errorId,
        category: e.category,
        incorrect: e.incorrect,
        correction: e.correction,
        explanationEn: e.explanationEn ?? null,
      },
    });
  }
}

/** Called from recordDrillResult when a learner answers incorrectly. */
export async function enqueueDrillMistake(
  drz: DrizzleD1Database,
  userId: number,
  exerciseId: number,
  payload: Record<string, unknown>,
): Promise<void> {
  await upsertQueueRow(drz, {
    userId,
    itemType: "exercise",
    itemKey: `exercise:${exerciseId}`,
    payload: { exerciseId, ...payload },
  });
}

export const getDueReviews = createServerFn({ method: "GET" }).handler(async () => {
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const userId = await currentUserId(drz);

  const due = await drz
    .select()
    .from(spacedRepQueue)
    .where(
      and(
        eq(spacedRepQueue.userId, userId),
        lte(spacedRepQueue.nextReviewDate, todayIso()),
      ),
    )
    .orderBy(asc(spacedRepQueue.nextReviewDate))
    .limit(DUE_BATCH);

  return due.map<ReviewCard>((r) => ({
    id: r.id,
    itemType: r.itemType,
    itemKey: r.itemKey,
    payload: r.payload ?? null,
    easeFactor: r.easeFactor,
    intervalDays: r.intervalDays,
    repetitions: r.repetitions,
    nextReviewDate: r.nextReviewDate,
  }));
});

export const recordReviewResult = createServerFn({ method: "POST" })
  .inputValidator((input: { queueId: number; correct: boolean }) => input)
  .handler(async ({ data }) => {
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    const userId = await currentUserId(drz);

    const row = await drz
      .select()
      .from(spacedRepQueue)
      .where(
        and(eq(spacedRepQueue.id, data.queueId), eq(spacedRepQueue.userId, userId)),
      )
      .limit(1);
    if (!row[0]) throw new Error("Queue row not found");
    const r = row[0];

    // SM-2 update.
    // Per acceptance: ease += 0.1 if correct, -= 0.2 if wrong (clamped ≥1.3).
    // interval *= ease on correct; reset to 1 on wrong.
    const newEase = Math.max(1.3, r.easeFactor + (data.correct ? 0.1 : -0.2));
    const newRepetitions = data.correct ? r.repetitions + 1 : 0;
    const newInterval = data.correct
      ? Math.max(1, Math.round(r.intervalDays * newEase))
      : 1;

    await drz
      .update(spacedRepQueue)
      .set({
        easeFactor: newEase,
        repetitions: newRepetitions,
        intervalDays: newInterval,
        lastReviewedAt: todayIso(),
        nextReviewDate: addDays(todayIso(), newInterval),
      })
      .where(eq(spacedRepQueue.id, r.id));

    return {
      queueId: r.id,
      easeFactor: newEase,
      intervalDays: newInterval,
      repetitions: newRepetitions,
    };
  });
