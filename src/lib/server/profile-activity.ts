import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { dailyCompletions, userLessonProgress } from "../../db/schema";
import type { db } from "../../db/client";

type Drizzle = ReturnType<typeof db>;

export const HEATMAP_WEEKS = 12;
const HEATMAP_DAYS = HEATMAP_WEEKS * 7;

/** One cell in the activity heatmap. `xp` drives the colour level. */
export interface HeatmapCell {
  /** ISO date (YYYY-MM-DD) in UTC. */
  date: string;
  /** Total XP earned that day. */
  xp: number;
}

/** Format a Date as a UTC YYYY-MM-DD string. */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build a contiguous 12-week (84-day) run of activity cells ending today,
 * driven by the per-day `daily_completions` rollup. Days with no row are
 * filled with `xp: 0` so the grid is always fully populated and the columns
 * line up week-on-week.
 *
 * `daily_completions` is the only per-day history we keep, so it is the
 * source of truth here. If a user predates the rollup their early cells read
 * as empty; that is an accepted limitation, not a bug.
 */
export async function getActivityHeatmap(
  drz: Drizzle,
  userRowId: number,
  now: Date = new Date(),
): Promise<HeatmapCell[]> {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - (HEATMAP_DAYS - 1));
  const startIso = isoDay(start);

  const rows = await drz
    .select({ date: dailyCompletions.date, xp: dailyCompletions.xpEarned })
    .from(dailyCompletions)
    .where(
      and(
        eq(dailyCompletions.userId, userRowId),
        gte(dailyCompletions.date, startIso),
      ),
    );

  const byDate = new Map(rows.map((r) => [r.date, r.xp]));

  const cells: HeatmapCell[] = [];
  for (let i = 0; i < HEATMAP_DAYS; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = isoDay(d);
    cells.push({ date: iso, xp: byDate.get(iso) ?? 0 });
  }
  return cells;
}

/** Count of distinct lessons this user has completed (status stamped). */
export async function getLessonsCompleted(
  drz: Drizzle,
  userRowId: number,
): Promise<number> {
  const res = await drz
    .select({ c: sql<number>`count(*)` })
    .from(userLessonProgress)
    .where(
      and(
        eq(userLessonProgress.userId, userRowId),
        isNotNull(userLessonProgress.completedAt),
      ),
    );
  return res[0]?.c ?? 0;
}
