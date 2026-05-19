import { describe, it, expect } from "vitest";
import { levenshtein } from "../levenshtein";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("hallo", "hallo")).toBe(0);
    expect(levenshtein("één", "één")).toBe(0);
  });

  it("returns length of the non-empty side when one is empty", () => {
    expect(levenshtein("", "hallo")).toBe(5);
    expect(levenshtein("hallo", "")).toBe(5);
  });

  it("counts a single insertion as distance 1", () => {
    expect(levenshtein("kat", "kant")).toBe(1);
    expect(levenshtein("hallo", "halloo")).toBe(1);
  });

  it("counts a single deletion as distance 1", () => {
    expect(levenshtein("kant", "kat")).toBe(1);
    expect(levenshtein("halo", "hal")).toBe(1);
  });

  it("counts a single substitution as distance 1", () => {
    expect(levenshtein("hallo", "hello")).toBe(1);
    expect(levenshtein("kat", "kut")).toBe(1);
  });

  it("treats a transposition as two edits (no Damerau shortcut)", () => {
    // "ab" → "ba" requires two substitutions, not one swap.
    expect(levenshtein("ab", "ba")).toBe(2);
    expect(levenshtein("school", "shcool")).toBe(2);
  });

  it("counts multiple edits across longer strings", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  it("treats Dutch diacritics as ordinary characters", () => {
    // ï is a distinct code unit from i, so swapping it counts as one substitution.
    expect(levenshtein("tïjdje", "tijdje")).toBe(1);
    // é → e is also a single substitution.
    expect(levenshtein("één", "een")).toBe(2); // two é's both swap
  });
});
