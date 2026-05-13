import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/client";
import {
  users,
  lessons,
  exercises,
  units,
  userLessonProgress,
  userUnitProgress,
  spacedRepQueue,
  xpEvents,
} from "../../db/schema";
import { eq, and, asc, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";
import { enqueueDrillMistake } from "./spaced-rep";
import { awardLessonComplete } from "./gamification";
import { awardBadgesIfEligible } from "./badges";

export type DrillType =
  | "match_pairs"
  | "multiple_choice"
  | "listening_mc"
  | "translation_typing"
  | "fill_blank"
  | "word_ordering";

export type LessonPayload = {
  user: {
    displayName: string;
    xpTotal: number;
    coinsBalance: number;
    streakDays: number;
    streakFreezesBalance: number;
  };
  lesson: {
    id: number;
    titleNl: string;
    titleEn: string;
    xpReward: number;
    unitSlug: string;
  };
  drills: Array<DrillPayload>;
  reviews: Array<ReviewCardPayload>;
};

export type ReviewCardPayload = {
  id: number;
  itemType: string;
  itemKey: string;
  payload: Record<string, unknown> | null;
};

export type DrillPayload = {
  id: number;
  slug: string;
  type: DrillType;
  promptNl: string | null;
  promptEn: string | null;
  options: string | null;
  answer: string | null;
  hints: string[] | null;
  audioUrl: string | null;
};

export const getLesson = createServerFn({ method: "GET" })
  .inputValidator((input: { lessonId: number }) => input)
  .handler(async ({ data }): Promise<LessonPayload> => {
    const a = await auth();
    if (!a.userId) throw redirect({ to: "/sign-in" });
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

    const lessonRow = await drz
      .select()
      .from(lessons)
      .where(eq(lessons.id, data.lessonId))
      .limit(1);
    if (!lessonRow[0]) throw new Error("Lesson not found");

    const unitRow = await drz
      .select()
      .from(units)
      .where(eq(units.id, lessonRow[0].unitId))
      .limit(1);

    const drillRows = await drz
      .select()
      .from(exercises)
      .where(eq(exercises.lessonId, data.lessonId))
      .orderBy(asc(exercises.id));

    // US-019: surface up to 3 due review cards before the new content.
    const now = new Date().toISOString();
    const reviewRows = await drz
      .select()
      .from(spacedRepQueue)
      .where(
        and(
          eq(spacedRepQueue.userId, me[0].id),
          lte(spacedRepQueue.nextReviewDate, now),
        ),
      )
      .orderBy(asc(spacedRepQueue.nextReviewDate))
      .limit(3);

    return {
      user: {
        displayName: me[0].displayName,
        xpTotal: me[0].xpTotal,
        coinsBalance: me[0].coinsBalance,
        streakDays: me[0].streakDays,
        streakFreezesBalance: me[0].streakFreezesBalance,
      },
      lesson: {
        id: lessonRow[0].id,
        titleNl: lessonRow[0].titleNl,
        titleEn: lessonRow[0].titleEn,
        xpReward: lessonRow[0].xpReward,
        unitSlug: unitRow[0]?.slug ?? "",
      },
      drills: drillRows.map((d) => ({
        id: d.id,
        slug: d.slug,
        type: d.type as DrillType,
        promptNl: d.promptNl,
        promptEn: d.promptEn,
        // Re-serialise to JSON strings so the payload stays plain-serializable
        // for TanStack Start's transport. The client parses per-drill.
        options: d.options == null ? null : JSON.stringify(d.options),
        answer: d.answer == null ? null : JSON.stringify(d.answer),
        hints: d.hints,
        audioUrl: d.audioUrl,
      })),
      reviews: reviewRows.map((r) => ({
        id: r.id,
        itemType: r.itemType,
        itemKey: r.itemKey,
        payload: r.payload ?? null,
      })),
    };
  });

export const recordDrillResult = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { exerciseId: number; correct: boolean; userAnswer?: string }) => input,
  )
  .handler(async ({ data }) => {
    const a = await auth();
    if (!a.userId) throw redirect({ to: "/sign-in" });
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

    if (!data.correct) {
      // US-019: route through the cap-aware SM-2 helper so a flurry of wrong
      // drill answers doesn't blow past the 10-item active-review cap.
      await enqueueDrillMistake(drz, me[0].id, data.exerciseId, {
        lastUserAnswer: data.userAnswer ?? null,
      });
    }
    return { ok: true };
  });

export const completeLesson = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { lessonId: number; correctCount: number; incorrectCount: number }) => input,
  )
  .handler(async ({ data }) => {
    const a = await auth();
    if (!a.userId) throw redirect({ to: "/sign-in" });
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

    const lessonRow = await drz
      .select()
      .from(lessons)
      .where(eq(lessons.id, data.lessonId))
      .limit(1);
    if (!lessonRow[0]) throw new Error("Lesson not found");
    const lesson = lessonRow[0];

    const now = new Date().toISOString();

    // Upsert user_lesson_progress -> completed.
    const existing = await drz
      .select()
      .from(userLessonProgress)
      .where(
        and(
          eq(userLessonProgress.userId, me[0].id),
          eq(userLessonProgress.lessonId, lesson.id),
        ),
      )
      .limit(1);

    let alreadyDone = false;
    if (existing[0]) {
      alreadyDone = existing[0].status === "completed";
      await drz
        .update(userLessonProgress)
        .set({
          status: "completed",
          correctCount: data.correctCount,
          incorrectCount: data.incorrectCount,
          // Keep historical xpEarned on the row; awardLessonComplete decides
          // the actual XP/coin grant based on alreadyDone.
          xpEarned: alreadyDone ? existing[0].xpEarned : 20,
          completedAt: existing[0].completedAt ?? now,
          updatedAt: now,
        })
        .where(eq(userLessonProgress.id, existing[0].id));
    } else {
      await drz.insert(userLessonProgress).values({
        userId: me[0].id,
        lessonId: lesson.id,
        status: "completed",
        correctCount: data.correctCount,
        incorrectCount: data.incorrectCount,
        xpEarned: 20,
        startedAt: now,
        completedAt: now,
        updatedAt: now,
      });
    }

    // US-020: XP + coins + daily_completions + streak.
    const award = await awardLessonComplete(drz, me[0].id, lesson.id, alreadyDone);
    const xpAwarded = award.xpAwarded;

    // Bump unit lessons_completed counter.
    const unitProg = await drz
      .select()
      .from(userUnitProgress)
      .where(
        and(eq(userUnitProgress.userId, me[0].id), eq(userUnitProgress.unitId, lesson.unitId)),
      )
      .limit(1);
    if (unitProg[0]) {
      if (!alreadyDone) {
        await drz
          .update(userUnitProgress)
          .set({
            lessonsCompleted: sql`${userUnitProgress.lessonsCompleted} + 1`,
            status: "in_progress",
            updatedAt: now,
          })
          .where(eq(userUnitProgress.id, unitProg[0].id));
      }
    } else {
      // No progress row yet — create one.
      const totalLessons = await drz
        .select()
        .from(lessons)
        .where(eq(lessons.unitId, lesson.unitId));
      await drz.insert(userUnitProgress).values({
        userId: me[0].id,
        unitId: lesson.unitId,
        status: "in_progress",
        lessonsCompleted: 1,
        lessonsTotal: totalLessons.length,
        startedAt: now,
        updatedAt: now,
      });
    }

    const newBadges = await awardBadgesIfEligible(drz, me[0].id);

    return {
      ok: true,
      xpAwarded,
      coinsAwarded: award.coinsAwarded,
      streakDays: award.streakDays,
      freezeUsed: award.freezeUsed,
      newBadges,
    };
  });
