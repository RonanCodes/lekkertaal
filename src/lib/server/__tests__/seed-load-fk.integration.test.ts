/**
 * Integration test for the seed loader's cross-environment FK resolution
 * (issue #87).
 *
 * Loads `drizzle/seed/seed-data.sql` into a fresh in-memory SQLite (with
 * `foreign_keys = ON`) and asserts:
 *
 *   1. The seed file uses `(SELECT id FROM ... WHERE slug = ...)` subqueries
 *      for every foreign-key integer column, never bare integers. This is
 *      what makes the seed portable across D1 instances whose autoincrement
 *      state diverges from the local dev DB.
 *   2. Loading the seed end-to-end against a fresh schema does not raise
 *      `FOREIGN KEY constraint failed` (the exact failure mode reported in
 *      #87 when running `pnpm seed:load --remote`).
 *   3. After load, FK columns are populated with non-null integers (proving
 *      the subqueries resolved to real ids), and every FK actually points at
 *      an existing parent row.
 *
 * If this test ever fails on (1), the seed generator regressed by emitting a
 * literal integer for a FK column; on (2)/(3), the subqueries themselves are
 * wrong (probably a slug typo or a missing parent row).
 */
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../..");
const SEED_SQL_PATH = join(REPO_ROOT, "drizzle/seed/seed-data.sql");
const MIGRATIONS_DIR = join(REPO_ROOT, "drizzle");

function makeFreshDb(): Database.Database {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    if (!sql.trim()) continue;
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      sqlite.exec(stmt);
    }
  }
  return sqlite;
}

describe("seed-load: cross-env FK resolution (#87)", () => {
  it("emits subqueries for every FK integer column, never bare integers", () => {
    if (!existsSync(SEED_SQL_PATH)) {
      throw new Error(
        `Seed SQL not found at ${SEED_SQL_PATH}. Run 'pnpm seed:load --emit-only' first.`,
      );
    }
    const sql = readFileSync(SEED_SQL_PATH, "utf8");

    // For each table with FK integer columns, the FIRST positional value in
    // VALUES (...) should be a `(SELECT id FROM ...)` subquery. The seed
    // generator always emits FK columns first.
    const fkChecks: Array<{ table: string; firstColIsFk: boolean }> = [
      { table: "units", firstColIsFk: true }, // course_id
      { table: "lessons", firstColIsFk: true }, // unit_id
      { table: "exercises", firstColIsFk: true }, // lesson_id (may be NULL)
      { table: "scenarios", firstColIsFk: true }, // unit_id (may be NULL)
    ];

    for (const { table } of fkChecks) {
      const lineRegex = new RegExp(
        `^INSERT OR IGNORE INTO ${table} \\(([^)]+)\\) VALUES \\(([^;]+)\\);$`,
        "gm",
      );
      let matchedRows = 0;
      let bareIntegerFkRows = 0;
      let match: RegExpExecArray | null;
      while ((match = lineRegex.exec(sql)) !== null) {
        matchedRows++;
        const valuesPart = match[2];
        // First value is everything up to the first top-level comma. Subquery
        // values contain commas inside parens, so we have to balance parens.
        let depth = 0;
        let end = -1;
        for (let i = 0; i < valuesPart.length; i++) {
          const ch = valuesPart[i];
          if (ch === "(") depth++;
          else if (ch === ")") depth--;
          else if (ch === "," && depth === 0) {
            end = i;
            break;
          }
        }
        const firstVal = (end === -1 ? valuesPart : valuesPart.slice(0, end)).trim();
        const isSubquery = firstVal.startsWith("(SELECT id FROM ");
        const isNull = firstVal === "NULL";
        if (!isSubquery && !isNull) {
          bareIntegerFkRows++;
        }
      }
      expect(matchedRows, `expected to find at least one ${table} INSERT row`).toBeGreaterThan(0);
      expect(
        bareIntegerFkRows,
        `${table}: ${bareIntegerFkRows}/${matchedRows} rows have a bare-integer FK (should be 0; use fkSlug helper)`,
      ).toBe(0);
    }
  });

  it("loads cleanly into a fresh DB without FK constraint failures", () => {
    const sqlite = makeFreshDb();
    const seedSql = readFileSync(SEED_SQL_PATH, "utf8");
    // Sanity: FK enforcement is actually on.
    const fkPragma = sqlite.pragma("foreign_keys", { simple: true });
    expect(fkPragma).toBe(1);

    // exec runs the whole file as one batch. If any FK fails, this throws.
    expect(() => sqlite.exec(seedSql)).not.toThrow();
  });

  it("populates FK columns with valid ids after load (proves subqueries resolved)", () => {
    const sqlite = makeFreshDb();
    sqlite.exec(readFileSync(SEED_SQL_PATH, "utf8"));

    // No orphan units.
    const orphanUnits = sqlite
      .prepare(
        `SELECT count(*) AS n FROM units u LEFT JOIN courses c ON c.id = u.course_id WHERE u.course_id IS NOT NULL AND c.id IS NULL`,
      )
      .get() as { n: number };
    expect(orphanUnits.n, "units with course_id pointing at nothing").toBe(0);

    // No orphan lessons.
    const orphanLessons = sqlite
      .prepare(
        `SELECT count(*) AS n FROM lessons l LEFT JOIN units u ON u.id = l.unit_id WHERE u.id IS NULL`,
      )
      .get() as { n: number };
    expect(orphanLessons.n, "lessons with unit_id pointing at nothing").toBe(0);

    // No orphan exercises (skip rows where lesson_id is intentionally NULL).
    const orphanExercises = sqlite
      .prepare(
        `SELECT count(*) AS n FROM exercises e LEFT JOIN lessons l ON l.id = e.lesson_id WHERE e.lesson_id IS NOT NULL AND l.id IS NULL`,
      )
      .get() as { n: number };
    expect(orphanExercises.n, "exercises with lesson_id pointing at nothing").toBe(0);

    // No orphan scenarios.
    const orphanScenarios = sqlite
      .prepare(
        `SELECT count(*) AS n FROM scenarios s LEFT JOIN units u ON u.id = s.unit_id WHERE s.unit_id IS NOT NULL AND u.id IS NULL`,
      )
      .get() as { n: number };
    expect(orphanScenarios.n, "scenarios with unit_id pointing at nothing").toBe(0);

    // Sanity: at least some content actually loaded.
    const courseCount = sqlite.prepare(`SELECT count(*) AS n FROM courses`).get() as { n: number };
    expect(courseCount.n).toBeGreaterThan(0);
    const unitCount = sqlite.prepare(`SELECT count(*) AS n FROM units`).get() as { n: number };
    expect(unitCount.n).toBeGreaterThan(0);
    const lessonCount = sqlite.prepare(`SELECT count(*) AS n FROM lessons`).get() as { n: number };
    expect(lessonCount.n).toBeGreaterThan(0);
  });

  it("succeeds against a DB where course autoincrement diverges from local (reproduces #87 scenario)", () => {
    // Simulate the actual prod failure: pre-insert an unrelated course row so
    // that the next `a1-starter` insert ends up with a higher autoincrement
    // id than the local DB used (id=2 locally vs id=4 in prod). With bare
    // integers in the seed this fails with FOREIGN KEY constraint failed;
    // with subqueries it must succeed regardless.
    const sqlite = makeFreshDb();
    sqlite.exec(`
      INSERT INTO courses (slug, title, cefr_level, language, is_published)
      VALUES ('pre-existing-noise', 'noise', 'A1', 'nl', 1);
      INSERT INTO courses (slug, title, cefr_level, language, is_published)
      VALUES ('pre-existing-noise-2', 'noise 2', 'A1', 'nl', 1);
      INSERT INTO courses (slug, title, cefr_level, language, is_published)
      VALUES ('pre-existing-noise-3', 'noise 3', 'A1', 'nl', 1);
    `);

    expect(() => sqlite.exec(readFileSync(SEED_SQL_PATH, "utf8"))).not.toThrow();

    // The a1-starter course will now be id >= 4, not 2. Confirm the A1 units
    // resolved against the right course.
    const a1CourseId = (
      sqlite.prepare(`SELECT id FROM courses WHERE slug = 'a1-starter'`).get() as { id: number }
    ).id;
    expect(a1CourseId).toBeGreaterThanOrEqual(4);

    const a1Units = sqlite
      .prepare(`SELECT count(*) AS n FROM units WHERE course_id = ?`)
      .get(a1CourseId) as { n: number };
    expect(a1Units.n).toBeGreaterThan(0);
  });
});
