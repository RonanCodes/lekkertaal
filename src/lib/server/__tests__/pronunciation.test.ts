/**
 * Unit tests for the pure `scorePronunciation` function (issue #55).
 *
 * Covers the six acceptance-criteria cases from the issue plus a few extra
 * edge cases (empty inputs, ordering invariants, status accounting).
 *
 * Pure-function tests; no DB, no fetch, no fixtures.
 */
import { describe, it, expect } from "vitest";
import { scorePronunciation, tokeniseForScoring } from "../pronunciation";

describe("tokeniseForScoring", () => {
  it("lowercases and strips punctuation", () => {
    expect(tokeniseForScoring("Hallo, wereld!")).toEqual(["hallo", "wereld"]);
  });

  it("collapses whitespace and ignores empties", () => {
    expect(tokeniseForScoring("  ik   ga  ")).toEqual(["ik", "ga"]);
  });

  it("returns [] for blank input", () => {
    expect(tokeniseForScoring("")).toEqual([]);
    expect(tokeniseForScoring("   ")).toEqual([]);
  });
});

describe("scorePronunciation", () => {
  it("scores identical strings as 100", () => {
    const r = scorePronunciation("Ik ga naar school", "Ik ga naar school");
    expect(r.score).toBe(100);
    expect(r.tokens.every((t) => t.status === "match")).toBe(true);
    expect(r.tokens.map((t) => t.word)).toEqual(["ik", "ga", "naar", "school"]);
  });

  it("scores casing- and punctuation-different strings as 100", () => {
    const r = scorePronunciation("Ik ga naar school.", "ik GA, naar  school!");
    expect(r.score).toBe(100);
    expect(r.tokens.filter((t) => t.status !== "match")).toHaveLength(0);
  });

  it("scores a one-word swap high but below 100", () => {
    const r = scorePronunciation("Ik ga naar school", "Ik ga naar huis");
    // 1 substitution out of 4 canonical tokens → 75.
    expect(r.score).toBe(75);
    const wrong = r.tokens.find((t) => t.status === "wrong");
    expect(wrong).toBeDefined();
    expect(wrong?.word).toBe("school");
    expect(wrong?.spoken).toBe("huis");
  });

  it("scores pure gibberish near zero", () => {
    const r = scorePronunciation("Ik ga naar school", "xyz qqq foo bar baz");
    // 4 substitutions + 1 extra = distance 5, canonical len 4 → clamped to 0.
    expect(r.score).toBe(0);
    expect(r.tokens.some((t) => t.status === "wrong")).toBe(true);
    expect(r.tokens.some((t) => t.status === "extra")).toBe(true);
  });

  it("flags a missing word and lowers the score", () => {
    const r = scorePronunciation("Ik ga naar school", "Ik ga school");
    // 1 deletion out of 4 canonical → 75.
    expect(r.score).toBe(75);
    const missing = r.tokens.filter((t) => t.status === "missing");
    expect(missing).toHaveLength(1);
    expect(missing[0].word).toBe("naar");
  });

  it("flags an extra word and lowers the score", () => {
    const r = scorePronunciation("Ik ga naar school", "Ik ga snel naar school");
    // 1 insertion → distance 1, denom 4 → 75.
    expect(r.score).toBe(75);
    const extras = r.tokens.filter((t) => t.status === "extra");
    expect(extras).toHaveLength(1);
    expect(extras[0].word).toBe("snel");
  });

  it("preserves canonical token order in the diff", () => {
    const r = scorePronunciation("een twee drie vier", "een twee vier");
    const orderedCanonical = r.tokens
      .filter((t) => t.status === "match" || t.status === "missing" || t.status === "wrong")
      .map((t) => t.word);
    expect(orderedCanonical).toEqual(["een", "twee", "drie", "vier"]);
  });

  it("handles empty transcript as zero with all-missing tokens", () => {
    const r = scorePronunciation("Hallo wereld", "");
    expect(r.score).toBe(0);
    expect(r.tokens.map((t) => t.status)).toEqual(["missing", "missing"]);
  });

  it("handles empty canonical as zero with all-extra tokens", () => {
    const r = scorePronunciation("", "Hallo wereld");
    expect(r.score).toBe(0);
    expect(r.tokens.map((t) => t.status)).toEqual(["extra", "extra"]);
  });

  it("handles both-empty as 100 / no tokens", () => {
    const r = scorePronunciation("", "");
    expect(r.score).toBe(100);
    expect(r.tokens).toEqual([]);
  });

  it("scores a partial-credit two-error sentence", () => {
    // canonical: 5 words. swap one + drop one → distance 2, denom 5 → 60.
    const r = scorePronunciation(
      "Ik woon in Amsterdam nu",
      "Ik woon in Rotterdam",
    );
    expect(r.score).toBe(60);
  });
});
