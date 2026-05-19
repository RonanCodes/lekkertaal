import { describe, it, expect } from "vitest";
import { buildListeningSpellTail, buildFlashcardTail } from "../lesson";
import { makeTestDb, asD1, seedUser } from "./test-db";

const POOL = [
  { nl: "huis", en: "house" },
  { nl: "boom", en: "tree" },
  { nl: "boek", en: "book" },
  { nl: "tafel", en: "table" },
  { nl: "stoel", en: "chair" },
  { nl: "kat", en: "cat" },
];

describe("buildListeningSpellTail", () => {
  it("returns 2 synthetic listening-spell drills when the pool is big enough", () => {
    const tail = buildListeningSpellTail(POOL, 42);
    expect(tail).toHaveLength(2);
    for (const drill of tail) {
      expect(drill.type).toBe("listening_spell");
      expect(drill.isSynthetic).toBe(true);
      expect(drill.id).toBeLessThan(0);
      const pair = JSON.parse(drill.answer!);
      expect(typeof pair.nl).toBe("string");
      expect(typeof pair.en).toBe("string");
      // Sampled pair must come from the unit pool.
      expect(POOL.some((p) => p.nl === pair.nl && p.en === pair.en)).toBe(true);
    }
  });

  it("returns an empty list when the pool is smaller than the tail count", () => {
    expect(buildListeningSpellTail([POOL[0]], 1)).toEqual([]);
    expect(buildListeningSpellTail([], 1)).toEqual([]);
  });

  it("generates lesson-scoped negative ids that don't collide across lessons", () => {
    const a = buildListeningSpellTail(POOL, 1);
    const b = buildListeningSpellTail(POOL, 2);
    const aIds = new Set(a.map((d) => d.id));
    const bIds = new Set(b.map((d) => d.id));
    for (const id of aIds) expect(bIds.has(id)).toBe(false);
  });

  it("never collides with buildFlashcardTail ids (different negative ranges)", async () => {
    const drz = makeTestDb();
    const userId = seedUser(drz);
    const spell = buildListeningSpellTail(POOL, 1);
    const flash = await buildFlashcardTail(POOL, 1, userId, asD1(drz));
    const spellIds = new Set(spell.map((d) => d.id));
    const flashIds = new Set(flash.map((d) => d.id));
    for (const id of spellIds) expect(flashIds.has(id)).toBe(false);
    // Sanity: spell ids are in the -2M range, flash ids in the -1M range.
    for (const id of spellIds) expect(id).toBeLessThan(-1_999_999);
    for (const id of flashIds) expect(id).toBeGreaterThan(-2_000_000);
  });
});
