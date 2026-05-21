/**
 * Integration tests for the lesson-grained path loader (issue #224).
 *
 * Exercises `buildPathForUser` against the in-memory D1 harness so the real
 * Drizzle schema and FK rules participate. Covers the #224 acceptance:
 *
 *   - the loader returns per-lesson summaries per unit, ordered by lesson order
 *   - each tile deep-links to `/app/lesson/:id`; locked lessons have null href
 *   - tile states (done / current / available / locked) track per-lesson
 *     progress + the owning unit's status
 *   - the first unit defaults to unlocked when no progress row exists
 *   - count fields stay consistent with the live lesson rows
 */
import { describe, it, expect, beforeEach } from "vitest";
import { buildPathForUser } from "../path";
import { asD1, makeTestDb, seedUser } from "./test-db";
import type { TestDb } from "./test-db";

function seedUnit(
  drz: TestDb,
  opts: { slug: string; order: number; cefrLevel?: string },
): number {
  const r = drz.$sqlite
    .prepare(
      `INSERT INTO units (slug, title_nl, title_en, cefr_level, "order")
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(opts.slug, opts.slug, opts.slug, opts.cefrLevel ?? "A2", opts.order);
  return Number(r.lastInsertRowid);
}

function seedLesson(
  drz: TestDb,
  opts: { unitId: number; slug: string; order: number },
): number {
  const r = drz.$sqlite
    .prepare(
      `INSERT INTO lessons (unit_id, slug, title_nl, title_en, "order")
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(opts.unitId, opts.slug, opts.slug, opts.slug, opts.order);
  return Number(r.lastInsertRowid);
}

function seedUnitProgress(
  drz: TestDb,
  opts: { userId: number; unitId: number; status: string },
): void {
  drz.$sqlite
    .prepare(
      `INSERT INTO user_unit_progress (user_id, unit_id, status) VALUES (?, ?, ?)`,
    )
    .run(opts.userId, opts.unitId, opts.status);
}

function seedLessonProgress(
  drz: TestDb,
  opts: { userId: number; lessonId: number; status: string },
): void {
  drz.$sqlite
    .prepare(
      `INSERT INTO user_lesson_progress (user_id, lesson_id, status) VALUES (?, ?, ?)`,
    )
    .run(opts.userId, opts.lessonId, opts.status);
}

describe("buildPathForUser (integration: in-memory D1)", () => {
  let drz: TestDb;
  let userId: number;

  beforeEach(() => {
    drz = makeTestDb();
    userId = seedUser(drz);
  });

  it("returns per-lesson summaries deep-linking to /app/lesson/:id", async () => {
    const u = seedUnit(drz, { slug: "groeten", order: 1 });
    const l1 = seedLesson(drz, { unitId: u, slug: "groeten-1", order: 1 });
    const l2 = seedLesson(drz, { unitId: u, slug: "groeten-2", order: 2 });
    const l3 = seedLesson(drz, { unitId: u, slug: "groeten-3", order: 3 });
    seedUnitProgress(drz, { userId, unitId: u, status: "in_progress" });
    seedLessonProgress(drz, { userId, lessonId: l1, status: "completed" });

    const path = await buildPathForUser(asD1(drz), userId, "A2");

    expect(path).toHaveLength(1);
    const lessons = path[0].lessons;
    expect(lessons.map((l) => l.order)).toEqual([1, 2, 3]);
    expect(lessons.map((l) => l.state)).toEqual(["done", "current", "available"]);
    expect(lessons[0].href).toBe(`/app/lesson/${l1}`);
    expect(lessons[1].href).toBe(`/app/lesson/${l2}`);
    expect(lessons[2].href).toBe(`/app/lesson/${l3}`);
    // Count fields stay consistent with live lesson rows.
    expect(path[0].lessonsCompleted).toBe(1);
    expect(path[0].lessonsTotal).toBe(3);
  });

  it("locks every lesson tile (null href) for a locked unit", async () => {
    // First unit is unlocked-by-default, so make this the second unit.
    seedUnit(drz, { slug: "first", order: 1 });
    const locked = seedUnit(drz, { slug: "locked-unit", order: 2 });
    seedLesson(drz, { unitId: locked, slug: "locked-1", order: 1 });
    seedLesson(drz, { unitId: locked, slug: "locked-2", order: 2 });

    const path = await buildPathForUser(asD1(drz), userId, "A2");
    const lockedUnit = path.find((u) => u.slug === "locked-unit")!;

    expect(lockedUnit.status).toBe("locked");
    expect(lockedUnit.lessons.every((l) => l.state === "locked")).toBe(true);
    expect(lockedUnit.lessons.every((l) => l.href === null)).toBe(true);
  });

  it("marks all tiles done for a completed unit", async () => {
    const u = seedUnit(drz, { slug: "done-unit", order: 1 });
    const l1 = seedLesson(drz, { unitId: u, slug: "done-1", order: 1 });
    const l2 = seedLesson(drz, { unitId: u, slug: "done-2", order: 2 });
    seedUnitProgress(drz, { userId, unitId: u, status: "completed" });
    seedLessonProgress(drz, { userId, lessonId: l1, status: "completed" });
    seedLessonProgress(drz, { userId, lessonId: l2, status: "completed" });

    const path = await buildPathForUser(asD1(drz), userId, "A2");

    expect(path[0].lessons.map((l) => l.state)).toEqual(["done", "done"]);
    expect(path[0].lessonsCompleted).toBe(2);
  });

  it("defaults the first unit to unlocked with the first lesson current", async () => {
    const u = seedUnit(drz, { slug: "fresh", order: 1 });
    seedLesson(drz, { unitId: u, slug: "fresh-1", order: 1 });
    seedLesson(drz, { unitId: u, slug: "fresh-2", order: 2 });
    // No progress rows at all.

    const path = await buildPathForUser(asD1(drz), userId, "A2");

    expect(path[0].status).toBe("unlocked");
    expect(path[0].lessons.map((l) => l.state)).toEqual(["current", "available"]);
    expect(path[0].lessons[0].href).not.toBeNull();
  });

  it("scopes to the user's CEFR level and orders units by order", async () => {
    seedUnit(drz, { slug: "a2-second", order: 2, cefrLevel: "A2" });
    seedUnit(drz, { slug: "a2-first", order: 1, cefrLevel: "A2" });
    seedUnit(drz, { slug: "b1-only", order: 1, cefrLevel: "B1" });

    const path = await buildPathForUser(asD1(drz), userId, "A2");

    expect(path.map((u) => u.slug)).toEqual(["a2-first", "a2-second"]);
  });
});
