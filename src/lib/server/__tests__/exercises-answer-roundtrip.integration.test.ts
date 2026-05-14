/**
 * Round-trip test for `exercises.answer` raw-string handling (issue #104).
 *
 * The seed loader writes `answer` as a plain string for translation-typing
 * (and most other drill types). Previously Drizzle had this column declared
 * with `mode: "json"`, which made the read side run `JSON.parse(...)` on
 * those raw strings and throw `SyntaxError`, 500-ing every translation-typing
 * lesson in prod.
 *
 * This test asserts:
 *   1. A plain-string answer like `"Mijn nationaliteit is (Iers)"` written
 *      via the seed style (no JSON encoding) reads back as the same string
 *      via Drizzle's typed select, with NO JSON.parse exception thrown.
 *   2. The exact failure case from issue #104 — `"Opdracht 2"` — round-trips
 *      cleanly.
 *
 * Regression guard: if anyone re-adds `mode: "json"` to `exercises.answer`,
 * the first read will throw and this test will fail loud.
 */
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { exercises } from "../../../db/schema";
import { makeTestDb } from "./test-db";

describe("exercises.answer round-trip (#104)", () => {
  it("reads back a translation-typing raw-string answer without JSON.parse errors", () => {
    const drz = makeTestDb();

    // Seed in the same shape `scripts/seed-load.ts` emits: raw text, NOT
    // JSON-encoded. The bug was Drizzle JSON.parse-ing this on read.
    drz.$sqlite
      .prepare(
        `INSERT INTO exercises (slug, type, prompt_en, answer)
         VALUES (?, 'translation-typing', ?, ?)`,
      )
      .run("a2-01-translation-typing-1", "Translate", "Mijn nationaliteit is (Iers)");

    // Pure Drizzle read — this used to throw SyntaxError.
    const rows = drz.select().from(exercises).where(eq(exercises.slug, "a2-01-translation-typing-1")).all();

    expect(rows).toHaveLength(1);
    expect(rows[0].answer).toBe("Mijn nationaliteit is (Iers)");
  });

  it("reads back the exact prod-failing payload `Opdracht 2`", () => {
    const drz = makeTestDb();

    drz.$sqlite
      .prepare(
        `INSERT INTO exercises (slug, type, answer)
         VALUES (?, 'translation-typing', ?)`,
      )
      .run("a2-02-translation-typing-1", "Opdracht 2");

    const rows = drz.select().from(exercises).where(eq(exercises.slug, "a2-02-translation-typing-1")).all();
    expect(rows[0].answer).toBe("Opdracht 2");
  });

  it("survives a payload that is NOT valid JSON (parentheses, no quotes)", () => {
    const drz = makeTestDb();

    // `Mijn nationaliteit is (Iers)` is the canonical reproduction string
    // from the bug: JSON.parse on it throws "Unexpected token 'M', ..."
    drz.$sqlite
      .prepare(
        `INSERT INTO exercises (slug, type, answer)
         VALUES (?, 'translation-typing', ?)`,
      )
      .run("a2-03-translation-typing-1", "Mijn nationaliteit is (Iers)");

    expect(() => drz.select().from(exercises).where(eq(exercises.slug, "a2-03-translation-typing-1")).all()).not.toThrow();
  });
});
