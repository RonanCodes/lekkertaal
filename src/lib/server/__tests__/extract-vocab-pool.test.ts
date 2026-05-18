import { describe, it, expect } from "vitest";
import { extractVocabPool } from "../lesson";

describe("extractVocabPool", () => {
  it("flattens multiple drill answers into one pool", () => {
    const a = JSON.stringify([
      { nl: "huis", en: "house" },
      { nl: "boom", en: "tree" },
    ]);
    const b = JSON.stringify([
      { nl: "tafel", en: "table" },
      { nl: "stoel", en: "chair" },
    ]);
    expect(extractVocabPool([a, b])).toEqual([
      { nl: "huis", en: "house" },
      { nl: "boom", en: "tree" },
      { nl: "tafel", en: "table" },
      { nl: "stoel", en: "chair" },
    ]);
  });

  it("de-duplicates pairs (case-insensitive)", () => {
    const a = JSON.stringify([{ nl: "Huis", en: "house" }]);
    const b = JSON.stringify([{ nl: "huis", en: "House" }]);
    const pool = extractVocabPool([a, b]);
    expect(pool).toHaveLength(1);
    expect(pool[0].nl.toLowerCase()).toBe("huis");
  });

  it("accepts already-parsed array shapes (drizzle json mode)", () => {
    const parsed = [{ nl: "boek", en: "book" }];
    expect(extractVocabPool([parsed])).toEqual([{ nl: "boek", en: "book" }]);
  });

  it("skips malformed entries without throwing", () => {
    const bad = JSON.stringify([
      { nl: "kat", en: "cat" },
      { nl: 42, en: "wat" }, // bad nl type
      { en: "alone" }, // missing nl
      null,
      "string",
    ]);
    expect(extractVocabPool([bad])).toEqual([{ nl: "kat", en: "cat" }]);
  });

  it("handles null / invalid JSON gracefully", () => {
    expect(extractVocabPool([null, "{not json", undefined])).toEqual([]);
  });

  it("handles empty input", () => {
    expect(extractVocabPool([])).toEqual([]);
  });
});
