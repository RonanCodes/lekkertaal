import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/client";
import type { DB } from "../../db/client";
import { units, userUnitProgress, lessons, userLessonProgress } from "../../db/schema";
import { eq, asc, inArray, and } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";
import { requireUserClerkId } from "./auth-helper";
import { ensureUserRow } from "./ensure-user-row";
import { listQuestsForUser, seedQuestsForUser } from "./daily-quests";
import type { QuestKind } from "./daily-quests";

export type PathQuest = {
  id: number;
  kind: QuestKind;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  bonusXp: number;
  bonusCoins: number;
  titleNl: string;
  titleEn: string;
};

/** Per-lesson state on a path tile. Mirrors the unit-detail status language. */
export type PathLessonState = "done" | "current" | "available" | "locked";

/**
 * A single lesson summary carried on a path tile (issue #224). The path used
 * to be unit-grained, so tiles synthesised their state from lesson counts and
 * deep-linked to the unit page. Now each tile maps to a real lesson row and
 * links straight to `/app/lesson/:id` (null `href` ⇒ inert/locked tile).
 */
export type PathLesson = {
  id: number;
  slug: string;
  order: number;
  titleNl: string;
  titleEn: string;
  state: PathLessonState;
  href: string | null;
};

export type PathUnit = {
  id: number;
  slug: string;
  titleNl: string;
  titleEn: string;
  order: number;
  status: "locked" | "unlocked" | "in_progress" | "completed";
  lessonsCompleted: number;
  lessonsTotal: number;
  /** Lesson-grained tiles for this unit, ordered by lesson.order (issue #224). */
  lessons: PathLesson[];
};

/**
 * Build the lesson-grained path for one user at one CEFR level. Factored out
 * of the `getPath` server fn (which owns auth + worker context) so it can be
 * exercised against the in-memory D1 harness in tests.
 *
 * Per-lesson state derives from `user_lesson_progress.status` joined onto the
 * unit's lesson rows, gated by the unit's own status:
 *   - locked unit            → every tile `locked`, `href` null
 *   - reachable unit         → completed lessons `done`; the first non-done
 *                              lesson `current`; the rest `available`
 * This matches the count-derived behaviour the #207 tiles used, but now keyed
 * off real per-lesson rows so each tile links to its own lesson.
 */
export async function buildPathForUser(
  drz: DB,
  userRowId: number,
  cefrLevel: string,
): Promise<PathUnit[]> {
  const levelUnits = await drz
    .select()
    .from(units)
    .where(eq(units.cefrLevel, cefrLevel))
    .orderBy(asc(units.order));

  const progressRows = await drz
    .select()
    .from(userUnitProgress)
    .where(eq(userUnitProgress.userId, userRowId));
  const progressByUnit = new Map(progressRows.map((p) => [p.unitId, p]));

  // All lessons across the level's units, in one query, then bucket by unit.
  const unitIds = levelUnits.map((u) => u.id);
  const lessonRows = unitIds.length
    ? await drz
        .select()
        .from(lessons)
        .where(inArray(lessons.unitId, unitIds))
        .orderBy(asc(lessons.order))
    : [];
  const lessonsByUnit = new Map<number, typeof lessonRows>();
  for (const l of lessonRows) {
    const bucket = lessonsByUnit.get(l.unitId);
    if (bucket) bucket.push(l);
    else lessonsByUnit.set(l.unitId, [l]);
  }

  // Per-lesson progress for this user, scoped to the lessons we just loaded.
  const lessonIds = lessonRows.map((l) => l.id);
  const lessonProgress = lessonIds.length
    ? await drz
        .select()
        .from(userLessonProgress)
        .where(
          and(
            eq(userLessonProgress.userId, userRowId),
            inArray(userLessonProgress.lessonId, lessonIds),
          ),
        )
    : [];
  const lessonStatusById = new Map(
    lessonProgress.map((p) => [p.lessonId, p.status]),
  );

  return levelUnits.map((u, i) => {
    const p = progressByUnit.get(u.id);
    let status: PathUnit["status"] = "locked";
    if (p) status = p.status as PathUnit["status"];
    // First unit defaults to unlocked even if no progress row exists yet
    if (!p && i === 0) status = "unlocked";

    const unitLessons = lessonsByUnit.get(u.id) ?? [];
    const isLocked = status === "locked";

    // Index of the first not-completed lesson within a reachable unit; that
    // tile reads "current". Everything before it is "done", after it
    // "available". -1 ⇒ all lessons done.
    const firstOpen = unitLessons.findIndex(
      (l) => lessonStatusById.get(l.id) !== "completed",
    );

    const pathLessons: PathLesson[] = unitLessons.map((l, li) => {
      let state: PathLessonState;
      if (isLocked) {
        state = "locked";
      } else if (lessonStatusById.get(l.id) === "completed") {
        state = "done";
      } else if (li === firstOpen) {
        state = "current";
      } else {
        state = "available";
      }
      return {
        id: l.id,
        slug: l.slug,
        order: l.order,
        titleNl: l.titleNl,
        titleEn: l.titleEn,
        state,
        href: state === "locked" ? null : `/app/lesson/${l.id}`,
      };
    });

    return {
      id: u.id,
      slug: u.slug,
      titleNl: u.titleNl,
      titleEn: u.titleEn,
      order: u.order,
      status,
      // Keep the count fields so the unit badge and any count-based callers
      // stay correct; prefer the live lesson rows when present.
      lessonsCompleted:
        unitLessons.length > 0
          ? pathLessons.filter((l) => l.state === "done").length
          : (p?.lessonsCompleted ?? 0),
      lessonsTotal:
        unitLessons.length > 0 ? unitLessons.length : (p?.lessonsTotal ?? 1),
      lessons: pathLessons,
    };
  });
}

export const getPath = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserClerkId();
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const me = [await ensureUserRow(userId, drz, env)];

  const path = await buildPathForUser(drz, me[0].id, me[0].cefrLevel);

  // P2-CON-3: ensure today's quests exist (covers the gap between cron ticks
  // for new users and the very first hour of a freshly-deployed env). Safe to
  // call on every loader hit because the helper short-circuits when rows
  // already exist for the user's local date.
  try {
    await seedQuestsForUser(drz, me[0].id, me[0].timezone);
  } catch {
    // Lazy-seed failure is non-fatal — the cron will recover on the next tick.
  }
  const quests = await listQuestsForUser(drz, me[0].id, me[0].timezone);

  return {
    user: {
      displayName: me[0].displayName,
      cefrLevel: me[0].cefrLevel,
      xpTotal: me[0].xpTotal,
      coinsBalance: me[0].coinsBalance,
      streakDays: me[0].streakDays,
      streakFreezesBalance: me[0].streakFreezesBalance,
    },
    path,
    quests,
  };
});
