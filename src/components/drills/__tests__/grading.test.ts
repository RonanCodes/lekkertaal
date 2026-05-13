import { describe, it, expect } from "vitest";
import {
  levenshtein,
  normaliseAnswer,
  gradeText,
} from "../DrillFrame";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("hallo", "hallo")).toBe(0);
  });

  it("returns length when one string is empty", () => {
    expect(levenshtein("", "hallo")).toBe(5);
    expect(levenshtein("hallo", "")).toBe(5);
  });

  it("counts single-character substitutions", () => {
    expect(levenshtein("hallo", "hello")).toBe(1);
    expect(levenshtein("kat", "kut")).toBe(1);
  });

  it("counts insertions and deletions", () => {
    expect(levenshtein("kat", "kant")).toBe(1);
    expect(levenshtein("kant", "kat")).toBe(1);
  });

  it("counts multiple edits", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("normaliseAnswer", () => {
  it("lowercases", () => {
    expect(normaliseAnswer("HALLO")).toBe("hallo");
    expect(normaliseAnswer("HaLLo")).toBe("hallo");
  });

  it("trims whitespace", () => {
    expect(normaliseAnswer("  hallo  ")).toBe("hallo");
  });

  it("collapses internal whitespace", () => {
    expect(normaliseAnswer("ik   ga  naar  school")).toBe("ik ga naar school");
  });

  it("strips terminal punctuation", () => {
    expect(normaliseAnswer("Hallo!")).toBe("hallo");
    expect(normaliseAnswer("Hallo, hoe gaat het?")).toBe("hallo hoe gaat het");
  });

  it("preserves Dutch diacritics", () => {
    // diacritics are part of Dutch words; gradeText still tolerates one typo,
    // so the answer "een tijdje" vs "een tïjdje" should still pass via Levenshtein 1
    expect(normaliseAnswer("één keer")).toBe("één keer");
  });
});

describe("gradeText", () => {
  it("accepts exact matches", () => {
    expect(gradeText("hallo", "hallo")).toBe(true);
  });

  it("accepts case-insensitive matches", () => {
    expect(gradeText("HALLO", "hallo")).toBe(true);
  });

  it("accepts trailing punctuation drops", () => {
    expect(gradeText("hallo!", "hallo")).toBe(true);
    expect(gradeText("hallo,", "hallo")).toBe(true);
  });

  it("accepts one-typo tolerance", () => {
    expect(gradeText("hallo", "hallp")).toBe(true);    // 1 substitution
    expect(gradeText("kat", "kant")).toBe(true);       // 1 insertion
    expect(gradeText("hallo", "halo")).toBe(true);     // 1 deletion
  });

  it("rejects two-or-more typos", () => {
    expect(gradeText("hallo", "hxllp")).toBe(false);
    expect(gradeText("kitten", "sitting")).toBe(false);
  });

  it("handles real Dutch examples", () => {
    expect(gradeText("Ik ga naar school.", "ik ga naar school")).toBe(true);
    expect(gradeText("Hoe gaat het?", "hoe gaat het")).toBe(true);
    // Wrong article: 'het' vs 'de' — multiple letter diff
    expect(gradeText("het huis", "de huis")).toBe(false);
  });

  it("treats empty user input as wrong against non-empty canonical", () => {
    expect(gradeText("", "hallo")).toBe(false);
  });
});
