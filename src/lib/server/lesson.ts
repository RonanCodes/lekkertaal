import { createServerFn } from "@tanstack/react-start";
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
import { eq, and, asc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";

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
  };
  lesson: {
    id: number;
    titleNl: string;
    titleEn: string;
    xpReward: number;
    unitSlug: string;
  };
  drills: Array<DrillPayload>;
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
    if (!a.userId) throw new Error("Not signed in");
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

    return {
      user: {
        displayName: me[0].displayName,
        xpTotal: me[0].xpTotal,
        coinsBalance: me[0].coinsBalance,
        streakDays: me[0].streakDays,
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
    };
  });

export const recordDrillResult = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { exerciseId: number; correct: boolean; userAnswer?: string }) => input,
  )
  .handler(async ({ data }) => {
    const a = await auth();
    if (!a.userId) throw new Error("Not signed in");
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

    if (!data.correct) {
      // Enqueue into spaced rep queue (SM-2 defaults). Upsert by (user,item).
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextReview = tomorrow.toISOString().slice(0, 10);
      try {
        await drz.insert(spacedRepQueue).values({
          userId: me[0].id,
          itemType: "exercise",
          itemKey: String(data.exerciseId),
          payload: { exerciseId: data.exerciseId, lastUserAnswer: data.userAnswer ?? null },
          nextReviewDate: nextReview,
        });
      } catch {
        // Already enqueued — reset interval to 1 day.
        await drz
          .update(spacedRepQueue)
          .set({
            intervalDays: 1,
            repetitions: 0,
            easeFactor: 2.5,
            nextReviewDate: nextReview,
            lastReviewedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(spacedRepQueue.userId, me[0].id),
              eq(spacedRepQueue.itemType, "exercise"),
              eq(spacedRepQueue.itemKey, String(data.exerciseId)),
            ),
          );
      }
    }
    return { ok: true };
  });

export const completeLesson = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { lessonId: number; correctCount: number; incorrectCount: number }) => input,
  )
  .handler(async ({ data }) => {
    const a = await auth();
    if (!a.userId) throw new Error("Not signed in");
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

    let xpAwarded = lesson.xpReward;
    let alreadyDone = false;
    if (existing[0]) {
      alreadyDone = existing[0].status === "completed";
      // Award XP only on first completion.
      if (alreadyDone) xpAwarded = 0;
      await drz
        .update(userLessonProgress)
        .set({
          status: "completed",
          correctCount: data.correctCount,
          incorrectCount: data.incorrectCount,
          xpEarned: alreadyDone ? existing[0].xpEarned : lesson.xpReward,
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
        xpEarned: lesson.xpReward,
        startedAt: now,
        completedAt: now,
        updatedAt: now,
      });
    }

    if (xpAwarded > 0) {
      // Bump XP + log event.
      await drz
        .update(users)
        .set({ xpTotal: sql`${users.xpTotal} + ${xpAwarded}` })
        .where(eq(users.id, me[0].id));
      await drz.insert(xpEvents).values({
        userId: me[0].id,
        delta: xpAwarded,
        reason: "lesson_complete",
        refType: "lesson",
        refId: String(lesson.id),
      });
    }

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

    return { ok: true, xpAwarded };
  });
