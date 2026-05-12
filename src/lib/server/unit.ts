import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/client";
import {
  users,
  units,
  lessons,
  vocab,
  grammarConcepts,
  userLessonProgress,
  scenarios,
} from "../../db/schema";
import { eq, asc, inArray, and } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";

export const getUnitDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const a = await auth();
    if (!a.userId) throw redirect({ to: "/sign-in" });
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

    const unitRow = await drz.select().from(units).where(eq(units.slug, data.slug)).limit(1);
    if (!unitRow[0]) throw new Error("Unit not found");
    const unit = unitRow[0];

    const lessonRows = await drz
      .select()
      .from(lessons)
      .where(eq(lessons.unitId, unit.id))
      .orderBy(asc(lessons.order));

    const lessonIds = lessonRows.map((l) => l.id);
    const progress = lessonIds.length
      ? await drz
          .select()
          .from(userLessonProgress)
          .where(
            and(
              eq(userLessonProgress.userId, me[0].id),
              inArray(userLessonProgress.lessonId, lessonIds),
            ),
          )
      : [];
    const progByLesson = new Map(progress.map((p) => [p.lessonId, p]));

    // Vocab — pull all rows for the unit's CEFR level as a quick preview pool.
    // (v0: vocab isn't FK-linked to unit; show a generic CEFR-level grid.)
    const vocabRows = await drz
      .select()
      .from(vocab)
      .where(eq(vocab.cefrLevel, unit.cefrLevel))
      .limit(40);

    // Grammar concept (optional)
    let grammar: typeof grammarConcepts.$inferSelect | null = null;
    if (unit.grammarConceptSlug) {
      const g = await drz
        .select()
        .from(grammarConcepts)
        .where(eq(grammarConcepts.slug, unit.grammarConceptSlug))
        .limit(1);
      grammar = g[0] ?? null;
    }

    // Boss-fight scenario for this unit
    const scen = await drz
      .select()
      .from(scenarios)
      .where(eq(scenarios.unitSlug, unit.slug))
      .limit(1);

    const allLessonsDone = lessonRows.every(
      (l) => progByLesson.get(l.id)?.status === "completed",
    );

    return {
      user: {
        displayName: me[0].displayName,
        xpTotal: me[0].xpTotal,
        coinsBalance: me[0].coinsBalance,
        streakDays: me[0].streakDays,
        streakFreezesBalance: me[0].streakFreezesBalance,
      },
      unit,
      lessons: lessonRows.map((l) => ({
        ...l,
        progress: progByLesson.get(l.id) ?? null,
      })),
      vocab: vocabRows,
      grammar,
      bossFight: scen[0]
        ? {
            slug: scen[0].slug,
            titleNl: scen[0].titleNl,
            titleEn: scen[0].titleEn,
            unlocked: allLessonsDone,
          }
        : null,
    };
  });
