import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/client";
import {
  lessons,
  exercises,
  units,
  userLessonProgress,
  userUnitProgress,
  spacedRepQueue,
} from "../../db/schema";
import { eq, and, asc, lte, sql  } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";
import { enqueueDrillMistake, enqueueVocabPairMistake } from "./spaced-rep";
import { awardLessonComplete } from "./gamification";
import { awardBadgesIfEligible } from "./badges";
import { requireUserClerkId } from "./auth-helper";
import { ensureUserRow } from "./ensure-user-row";

export type DrillType =
  | "match_pairs"
  | "multiple_choice"
  | "listening_mc"
  | "translation_typing"
  | "fill_blank"
  | "word_ordering"
  | "speak"
  | "image_word";

/**
 * DB rows store drill `type` in hyphen-form (`match-pairs`, `translation-typing`,
 * `fill-in-the-blank`, `multiple-choice`, `word-ordering`, `image-word`,
 * `listening-mc`) because the seed loader writes them verbatim. The renderer
 * and DrillType union use underscore-form. Normalise once at the server
 * boundary so every dispatch site sees the canonical underscore type.
 *
 * Without this, drills load from the DB with hyphens, miss every `switch`
 * case in DrillRenderer, and fall through to the "UNSUPPORTED DRILL" panel
 * (issue #114).
 */
const DRILL_TYPE_HYPHEN_TO_UNDERSCORE: Record<string, DrillType> = {
  "match-pairs": "match_pairs",
  "multiple-choice": "multiple_choice",
  "listening-mc": "listening_mc",
  "translation-typing": "translation_typing",
  "fill-blank": "fill_blank",
  "fill-in-the-blank": "fill_blank",
  "word-ordering": "word_ordering",
  "image-word": "image_word",
};

function normaliseDrillType(raw: string): DrillType {
  return DRILL_TYPE_HYPHEN_TO_UNDERSCORE[raw] ?? (raw as DrillType);
}

export type LessonPayload = {
  user: {
    displayName: string;
    xpTotal: number;
    coinsBalance: number;
    streakDays: number;
    streakFreezesBalance: number;
    sfxEnabled: boolean;
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
  /**
   * Every unique `{nl, en}` pair from all match-pairs exercises in the lesson's
   * unit. Match-pairs drills sample 4 random pairs from this pool each render,
   * so a lesson replayed twice does not show the same 4 words. Falls back to
   * the drill's own `answer` JSON if the pool is too small.
   */
  vocabPool: Array<{ nl: string; en: string }>;
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
  imageUrl: string | null;
};

export const getLesson = createServerFn({ method: "GET", strict: false })
  .inputValidator((input: { lessonId: number }) => input)
  .handler(async ({ data }): Promise<LessonPayload> => {
    const userId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = [await ensureUserRow(userId, drz, env)];

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

    // Build the unit-level vocab pool from every match-pairs exercise in this
    // lesson's unit. This is the source MatchPairsDrill samples 4 pairs from
    // on each render, so the same lesson replayed twice shows a different set
    // of words. Stays scoped to the unit so the topical fit (verbs, food,
    // greetings) is preserved. Exercises join to units via lessons.
    const unitPairRows = await drz
      .select({ answer: exercises.answer })
      .from(exercises)
      .innerJoin(lessons, eq(lessons.id, exercises.lessonId))
      .where(
        and(
          eq(lessons.unitId, lessonRow[0].unitId),
          eq(exercises.type, "match-pairs"),
        ),
      );
    const vocabPool = extractVocabPool(unitPairRows.map((r) => r.answer));

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
        sfxEnabled: me[0].sfxEnabled,
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
        type: normaliseDrillType(d.type),
        promptNl: d.promptNl,
        promptEn: d.promptEn,
        // Re-serialise to JSON strings so the payload stays plain-serializable
        // for TanStack Start's transport. The client parses per-drill.
        options: d.options == null ? null : JSON.stringify(d.options),
        answer: d.answer == null ? null : JSON.stringify(d.answer),
        hints: d.hints,
        audioUrl: d.audioUrl,
        imageUrl: d.imageUrl,
      })),
      reviews: reviewRows.map((r) => ({
        id: r.id,
        itemType: r.itemType,
        itemKey: r.itemKey,
        payload: r.payload ?? null,
      })),
      vocabPool,
    };
  });

/**
 * Flatten every match-pairs `answer` JSON blob into one de-duplicated list of
 * `{nl, en}` pairs. Drills store `answer` as either an already-parsed array
 * (Drizzle's json mode) or a JSON string, so probe for both shapes. Pairs are
 * keyed by `<nl>|<en>` lowercased so two drills that share "huis | house"
 * don't both appear in the pool.
 */
export function extractVocabPool(
  rawAnswers: ReadonlyArray<unknown>,
): Array<{ nl: string; en: string }> {
  const seen = new Set<string>();
  const out: Array<{ nl: string; en: string }> = [];
  for (const raw of rawAnswers) {
    const parsed = parseAnswer(raw);
    if (!Array.isArray(parsed)) continue;
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const nl = (entry as Record<string, unknown>).nl;
      const en = (entry as Record<string, unknown>).en;
      if (typeof nl !== "string" || typeof en !== "string") continue;
      const key = `${nl.toLowerCase()}|${en.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ nl, en });
    }
  }
  return out;
}

function parseAnswer(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

export const recordDrillResult = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { exerciseId: number; correct: boolean; userAnswer?: string }) => input,
  )
  .handler(async ({ data }) => {
    const userId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    const me = [await ensureUserRow(userId, drz, env)];

    if (!data.correct) {
      // US-019: route through the cap-aware SM-2 helper so a flurry of wrong
      // drill answers doesn't blow past the 10-item active-review cap.
      await enqueueDrillMistake(drz, me[0].id, data.exerciseId, {
        lastUserAnswer: data.userAnswer ?? null,
      });
    }
    return { ok: true };
  });

/**
 * Per-pair result for a match-pairs drill. Wrong pairs land in the spaced-rep
 * queue under `itemType: "vocab_pair"` so they come back in the user's next
 * review. Correct pairs are a no-op for v1: promotion happens via the
 * existing `/api/reviews` SM-2 path.
 */
export const recordVocabPairResult = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { nl: string; en: string; correct: boolean; exerciseId?: number }) => input,
  )
  .handler(async ({ data }) => {
    const userId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    const me = [await ensureUserRow(userId, drz, env)];

    if (!data.correct) {
      await enqueueVocabPairMistake(drz, me[0].id, {
        nl: data.nl,
        en: data.en,
        exerciseId: data.exerciseId ?? null,
      });
    }
    return { ok: true };
  });

export const completeLesson = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { lessonId: number; correctCount: number; incorrectCount: number }) => input,
  )
  .handler(async ({ data }) => {
    const userId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    const me = [await ensureUserRow(userId, drz, env)];

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
