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
import { eq, and, asc, lte, sql, desc  } from "drizzle-orm";
import type { DB } from "../../db/client";
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
  | "word_bank"
  | "speak"
  | "image_word"
  | "flashcard"
  | "listening_spell"
  | "picture_choice";

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
  "word-bank": "word_bank",
  "image-word": "image_word",
  "picture-choice": "picture_choice",
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
  /**
   * Every unique `{nl, en, imageUrl}` triple harvested from `image-word`
   * exercises in the lesson's unit. Picture-choice drills use this as the
   * distractor pool: pick 3 random tiles that aren't the correct answer.
   * When the pool has fewer than 4 entries, the picture-choice drill renders
   * a skip-frame rather than punishing the learner for missing seed content.
   */
  imagePool: Array<{ nl: string; en: string; imageUrl: string }>;
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
  /**
   * Set true for drills synthesized at the loader level (e.g. flashcards
   * sampled from the unit vocab pool, no row in the `exercises` table).
   * The lesson player skips `recordDrillResult` for synthetic drills so we
   * don't create dangling spaced_rep_queue rows under fake exercise ids.
   */
  isSynthetic?: boolean;
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

    // Build the unit-level image pool from every image-word exercise in this
    // lesson's unit. Picture-choice drills sample 3 distractors from this
    // pool so a learner sees fresh wrong-tiles each replay. We keep it
    // unit-scoped (not lesson-scoped) so even a unit's earliest lesson has
    // enough images to fill a 4-up grid.
    const unitImageRows = await drz
      .select({
        answer: exercises.answer,
        imageUrl: exercises.imageUrl,
      })
      .from(exercises)
      .innerJoin(lessons, eq(lessons.id, exercises.lessonId))
      .where(
        and(
          eq(lessons.unitId, lessonRow[0].unitId),
          eq(exercises.type, "image-word"),
        ),
      );
    const imagePool = extractImagePool(unitImageRows);

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
      drills: [
        ...drillRows.map((d) => ({
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
        // Listening-spell drills first so flashcards remain the final activity
        // (flashcards are the lowest-friction "lesson over" tail; spelling
        // tests should land before that).
        ...buildListeningSpellTail(vocabPool, lessonRow[0].id),
        ...(await buildFlashcardTail(vocabPool, lessonRow[0].id, me[0].id, drz)),
      ],
      reviews: reviewRows.map((r) => ({
        id: r.id,
        itemType: r.itemType,
        itemKey: r.itemKey,
        payload: r.payload ?? null,
      })),
      vocabPool,
      imagePool,
    };
  });

const FLASHCARD_TAIL_COUNT = 4;
/**
 * 70/30 split: of the 4 cards, up to 3 (≈75%, the closest integer match to
 * 70%) come from the learner's due vocab_pair queue, the rest fresh from the
 * pool. If the queue has fewer matches than the target, the shortfall is
 * filled from the pool so we always return exactly 4 cards (or 0 if the pool
 * is too thin to start with).
 */
const FLASHCARD_QUEUE_CAP = 3;

/**
 * Synthesize a small batch of flashcard drills at the end of a lesson, drawn
 * from the unit vocab pool. Each card is a `{nl, en}` pair the learner has
 * already seen (or can derive) earlier in the lesson; the flashcard surface
 * uses binary self-grading to feed `recordVocabPairResult`. Sampled fresh on
 * every getLesson call so a replayed lesson surfaces different cards.
 *
 * Biasing (US-009): when the user has due `vocab_pair` rows that intersect
 * the unit pool, up to 3 of the 4 cards are pulled from that queue (newest
 * due first), and the remaining slots are filled fresh from the pool. With
 * an empty queue (or no intersection) the function falls back to a uniform
 * sample across the pool, matching the pre-bias behaviour exactly.
 *
 * Returns an empty list when the pool is too thin to sample; the lesson then
 * looks unchanged (no awkward "0 flashcards" placeholder).
 */
export async function buildFlashcardTail(
  pool: ReadonlyArray<{ nl: string; en: string }>,
  lessonId: number,
  userId: number,
  drz: DB,
): Promise<DrillPayload[]> {
  if (pool.length < FLASHCARD_TAIL_COUNT) return [];

  // Build a lookup keyed by lowercased `<nl>|<en>` so we can intersect the
  // queue's itemKey directly. Storing the original-case pair lets us preserve
  // capitalisation in the flashcard payload (the queue stores its own copy in
  // `payload`, but the pool is the source of truth for casing in this lesson).
  const poolByKey = new Map<string, { nl: string; en: string }>();
  for (const p of pool) {
    poolByKey.set(`${p.nl.toLowerCase()}|${p.en.toLowerCase()}`, p);
  }

  // Pull every due vocab_pair row for this user, newest-due first. The query
  // is bounded by the per-user cap on the queue (MAX_ACTIVE_REVIEWS = 200) so
  // we don't need an explicit LIMIT here; we shuffle and slice after the
  // intersection step anyway.
  const now = new Date().toISOString();
  const dueRows = await drz
    .select({ itemKey: spacedRepQueue.itemKey })
    .from(spacedRepQueue)
    .where(
      and(
        eq(spacedRepQueue.userId, userId),
        eq(spacedRepQueue.itemType, "vocab_pair"),
        lte(spacedRepQueue.nextReviewDate, now),
      ),
    )
    .orderBy(desc(spacedRepQueue.nextReviewDate));

  // Intersect: only queue rows whose pair still lives in this unit's pool
  // count. A missed pair from a different unit (e.g. food vocab while the
  // learner is now in greetings) is irrelevant to this lesson's flashcards.
  const matched: Array<{ nl: string; en: string }> = [];
  const matchedKeys = new Set<string>();
  for (const r of dueRows) {
    const pair = poolByKey.get(r.itemKey);
    if (pair && !matchedKeys.has(r.itemKey)) {
      matched.push(pair);
      matchedKeys.add(r.itemKey);
    }
  }

  // Take up to 3 from the queue (random order so a learner with 6 misses
  // doesn't see the same 3 cards every replay), then fill the rest from the
  // pool excluding pairs we just took. Empty-queue path collapses to the
  // original uniform sample.
  const fromQueue = sampleRandom(matched, Math.min(FLASHCARD_QUEUE_CAP, matched.length));
  const remaining = FLASHCARD_TAIL_COUNT - fromQueue.length;
  const takenKeys = new Set(fromQueue.map((p) => `${p.nl.toLowerCase()}|${p.en.toLowerCase()}`));
  const poolRemaining = pool.filter(
    (p) => !takenKeys.has(`${p.nl.toLowerCase()}|${p.en.toLowerCase()}`),
  );
  const fromPool = sampleRandom(poolRemaining, remaining);
  const sampled = [...fromQueue, ...fromPool];

  return sampled.map((p, i) => ({
    id: -1_000_000 - lessonId * 100 - i, // negative + lesson-scoped so no collision with real ids
    slug: `synthetic-flashcard-${lessonId}-${i}`,
    type: "flashcard",
    promptNl: null,
    promptEn: "Do you remember this word?",
    options: null,
    answer: JSON.stringify(p),
    hints: null,
    audioUrl: null,
    imageUrl: null,
    isSynthetic: true,
  }));
}

const LISTENING_SPELL_TAIL_COUNT = 2;

/**
 * Synthesize a small batch of listening-spell drills at the end of a lesson,
 * drawn from the unit vocab pool. Each drill plays a Dutch headword and asks
 * the learner to type what they heard; grading is Levenshtein-≤1 client-side.
 *
 * Unlike `buildFlashcardTail`, no biasing is needed — listening-spell is a
 * production-style typing check, not a recall surface, so we sample fresh
 * from the pool each call. Returns an empty list when the pool is too thin.
 *
 * Negative ids live in the `-2_000_000` range so they never collide with the
 * flashcard tail's `-1_000_000` range nor with real DB ids (which are
 * positive auto-increments).
 */
export function buildListeningSpellTail(
  pool: ReadonlyArray<{ nl: string; en: string }>,
  lessonId: number,
): DrillPayload[] {
  if (pool.length < LISTENING_SPELL_TAIL_COUNT) return [];
  const sampled = sampleRandom(pool, LISTENING_SPELL_TAIL_COUNT);
  return sampled.map((p, i) => ({
    id: -2_000_000 - lessonId * 100 - i,
    slug: `synthetic-listening-spell-${lessonId}-${i}`,
    type: "listening_spell",
    promptNl: null,
    promptEn: "Listen and type what you hear",
    options: null,
    answer: JSON.stringify(p),
    hints: null,
    audioUrl: null,
    imageUrl: null,
    isSynthetic: true,
  }));
}

function sampleRandom<T>(arr: ReadonlyArray<T>, n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/**
 * Flatten every match-pairs `answer` JSON blob into one de-duplicated list of
 * `{nl, en}` pairs. Drills store `answer` as either an already-parsed array
 * (Drizzle's json mode) or a JSON string, so probe for both shapes. Pairs are
 * keyed by `<nl>|<en>` lowercased so two drills that share "huis | house"
 * don't both appear in the pool.
 */
/**
 * Build the image pool from `image-word` exercise rows. Each row carries an
 * `answer` (Dutch noun, or an array of acceptable Dutch surface forms) and
 * an `imageUrl` (R2 URL). We pick the first answer entry as the canonical
 * Dutch noun, skip rows without an imageUrl, and dedupe by lowercased nl.
 *
 * English meaning isn't reliably present on `image-word` rows, so the EN
 * field comes back as an empty string. Picture-choice doesn't surface EN
 * anyway — it shows the Dutch headword + 4 images.
 */
export function extractImagePool(
  rows: ReadonlyArray<{ answer: unknown; imageUrl: string | null }>,
): Array<{ nl: string; en: string; imageUrl: string }> {
  const seen = new Set<string>();
  const out: Array<{ nl: string; en: string; imageUrl: string }> = [];
  for (const row of rows) {
    if (!row.imageUrl) continue;
    const nl = extractFirstNoun(row.answer);
    if (!nl) continue;
    const key = nl.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ nl, en: "", imageUrl: row.imageUrl });
  }
  return out;
}

/**
 * Pull the canonical Dutch noun out of an image-word `answer` payload. The
 * column stores either a bare string ("huis") or a JSON-encoded array of
 * acceptable surface forms (`["kat","de kat"]`). We probe both shapes plus
 * the already-parsed array (drizzle json mode would return) and return the
 * first non-empty string we find. Anything else returns null.
 */
function extractFirstNoun(raw: unknown): string | null {
  if (typeof raw === "string") {
    // Try JSON first — a stringified array like `["kat","de kat"]` should
    // resolve to the first element. If JSON parse fails the column is a
    // bare noun like "huis" and we use it directly.
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
        return parsed[0];
      }
      if (typeof parsed === "string") return parsed;
    } catch {
      // Bare string column — fall through and use it as-is.
    }
    return raw.length > 0 ? raw : null;
  }
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string") {
    return raw[0];
  }
  return null;
}

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
