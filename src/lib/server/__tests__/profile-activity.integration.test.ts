/**
 * Integration tests for the profile-activity helpers that drive the 12-week
 * heatmap and the "Lessons" stat block. Runs against an in-memory SQLite DB
 * with the production schema.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getActivityHeatmap,
  getLessonsCompleted,
  HEATMAP_WEEKS,
} from "../profile-activity";
import { makeTestDb, asD1, seedUser } from "./test-db";
import type { TestDb } from "./test-db";
import { dailyCompletions, lessons, units, courses, userLessonProgress } from "../../../db/schema";

const HEATMAP_DAYS = HEATMAP_WEEKS * 7;
const NOW = new Date("2026-05-22T12:00:00.000Z");

function isoDay(offsetFromNow: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + offsetFromNow);
  return d.toISOString().slice(0, 10);
}

describe("profile-activity (integration: in-memory D1)", () => {
  let drz: TestDb;

  beforeEach(() => {
    drz = makeTestDb();
  });

  describe("getActivityHeatmap", () => {
    it("returns a contiguous 84-day run ending today, zero-filled", async () => {
      const userId = seedUser(drz);
      const cells = await getActivityHeatmap(asD1(drz), userId, NOW);

      expect(cells).toHaveLength(HEATMAP_DAYS);
      expect(cells[0].date).toBe(isoDay(-(HEATMAP_DAYS - 1)));
      expect(cells[cells.length - 1].date).toBe(isoDay(0));
      expect(cells.every((c) => c.xp === 0)).toBe(true);
    });

    it("maps daily_completions XP onto the right cells", async () => {
      const userId = seedUser(drz);
      await drz.insert(dailyCompletions).values([
        { userId, date: isoDay(0), xpEarned: 120, lessonsCompleted: 2, drillsCompleted: 5 },
        { userId, date: isoDay(-3), xpEarned: 30, lessonsCompleted: 1, drillsCompleted: 1 },
      ]);

      const cells = await getActivityHeatmap(asD1(drz), userId, NOW);
      const byDate = new Map(cells.map((c) => [c.date, c.xp]));

      expect(byDate.get(isoDay(0))).toBe(120);
      expect(byDate.get(isoDay(-3))).toBe(30);
      expect(byDate.get(isoDay(-1))).toBe(0);
    });

    it("ignores completions older than the 12-week window", async () => {
      const userId = seedUser(drz);
      await drz
        .insert(dailyCompletions)
        .values({ userId, date: isoDay(-200), xpEarned: 500, lessonsCompleted: 1, drillsCompleted: 0 });

      const cells = await getActivityHeatmap(asD1(drz), userId, NOW);
      expect(cells.every((c) => c.xp === 0)).toBe(true);
    });
  });

  describe("getLessonsCompleted", () => {
    it("counts only lessons with a completedAt stamp", async () => {
      const userId = seedUser(drz);
      await drz.insert(courses).values({ id: 1, slug: "nl", title: "Dutch", cefrLevel: "A1" });
      await drz
        .insert(units)
        .values({ id: 1, courseId: 1, slug: "u1", titleNl: "Eenheid 1", titleEn: "Unit 1", cefrLevel: "A1", order: 1 });
      await drz.insert(lessons).values([
        { id: 1, unitId: 1, slug: "l1", titleNl: "L1", titleEn: "L1", order: 1 },
        { id: 2, unitId: 1, slug: "l2", titleNl: "L2", titleEn: "L2", order: 2 },
        { id: 3, unitId: 1, slug: "l3", titleNl: "L3", titleEn: "L3", order: 3 },
      ]);
      await drz.insert(userLessonProgress).values([
        { userId, lessonId: 1, status: "completed", completedAt: isoDay(-1) },
        { userId, lessonId: 2, status: "completed", completedAt: isoDay(0) },
        { userId, lessonId: 3, status: "in_progress" },
      ]);

      expect(await getLessonsCompleted(asD1(drz), userId)).toBe(2);
    });

    it("returns 0 for a user with no completed lessons", async () => {
      const userId = seedUser(drz);
      expect(await getLessonsCompleted(asD1(drz), userId)).toBe(0);
    });
  });
});
