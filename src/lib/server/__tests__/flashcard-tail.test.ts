import { describe, it, expect } from "vitest";
import { buildFlashcardTail } from "../lesson";

const POOL = [
  { nl: "huis", en: "house" },
  { nl: "boom", en: "tree" },
  { nl: "boek", en: "book" },
  { nl: "tafel", en: "table" },
  { nl: "stoel", en: "chair" },
  { nl: "kat", en: "cat" },
];

describe("buildFlashcardTail", () => {
  it("returns 4 synthetic flashcard drills when pool is big enough", () => {
    const tail = buildFlashcardTail(POOL, 42);
    expect(tail).toHaveLength(4);
    for (const card of tail) {
      expect(card.type).toBe("flashcard");
      expect(card.isSynthetic).toBe(true);
      expect(card.id).toBeLessThan(0);
      const pair = JSON.parse(card.answer!);
      expect(typeof pair.nl).toBe("string");
      expect(typeof pair.en).toBe("string");
    }
  });

  it("returns an empty list when the pool is too small", () => {
    expect(buildFlashcardTail(POOL.slice(0, 3), 1)).toEqual([]);
    expect(buildFlashcardTail([], 1)).toEqual([]);
  });

  it("sampled pairs are drawn from the pool", () => {
    const tail = buildFlashcardTail(POOL, 1);
    const poolKeys = new Set(POOL.map((p) => `${p.nl}|${p.en}`));
    for (const card of tail) {
      const pair = JSON.parse(card.answer!);
      expect(poolKeys.has(`${pair.nl}|${pair.en}`)).toBe(true);
    }
  });

  it("generates lesson-scoped negative ids so multiple lessons don't collide", () => {
    const a = buildFlashcardTail(POOL, 1);
    const b = buildFlashcardTail(POOL, 2);
    const aIds = new Set(a.map((c) => c.id));
    const bIds = new Set(b.map((c) => c.id));
    for (const id of aIds) expect(bIds.has(id)).toBe(false);
  });
});
