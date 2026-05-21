import { describe, expect, it } from "vitest";
import {
  accuracyFromResult,
  milestoneBadge,
  pickCelebration,
} from "../app.lesson.$lessonId.complete";

/**
 * #234 — the lesson player now passes `?correct&total` to the complete screen.
 * These lock in the player→complete contract: a flawless run unlocks the
 * perfect state, any miss falls back to normal, and a missing result never
 * accidentally claims perfect. Milestone still wins when it applies.
 */
describe("pickCelebration", () => {
  it("unlocks perfect on a flawless run (correct >= total > 0)", () => {
    expect(pickCelebration({ correct: 8, total: 8, streakDays: 3 })).toBe("perfect");
  });

  it("stays normal when at least one drill was missed", () => {
    expect(pickCelebration({ correct: 7, total: 8, streakDays: 3 })).toBe("normal");
  });

  it("stays normal when no result params are supplied", () => {
    expect(pickCelebration({ streakDays: 3 })).toBe("normal");
  });

  it("does not claim perfect on an empty lesson (total 0)", () => {
    expect(pickCelebration({ correct: 0, total: 0, streakDays: 3 })).toBe("normal");
  });

  it("milestone wins over a perfect run when streak lands on a milestone day", () => {
    expect(pickCelebration({ correct: 8, total: 8, streakDays: 7 })).toBe("milestone");
  });

  it("honours an explicit milestone flag", () => {
    expect(pickCelebration({ correct: 5, total: 8, milestone: true, streakDays: 3 })).toBe(
      "milestone",
    );
  });
});

/**
 * #245 — the accuracy row renders from the passed correct/total. These lock in
 * the pure summary the row reads: rounded percentage, raw counts, and a hidden
 * row (null) whenever the player didn't pass a usable result.
 */
describe("accuracyFromResult", () => {
  it("summarises a partial run with rounded percentage", () => {
    expect(accuracyFromResult({ correct: 8, total: 9 })).toEqual({
      pct: 89,
      correct: 8,
      mistakes: 1,
    });
  });

  it("reports 100% with zero mistakes on a flawless run", () => {
    expect(accuracyFromResult({ correct: 10, total: 10 })).toEqual({
      pct: 100,
      correct: 10,
      mistakes: 0,
    });
  });

  it("returns null when no result was passed", () => {
    expect(accuracyFromResult({})).toBeNull();
  });

  it("returns null on an empty lesson (total 0)", () => {
    expect(accuracyFromResult({ correct: 0, total: 0 })).toBeNull();
  });

  it("clamps correct above total so mistakes never go negative", () => {
    expect(accuracyFromResult({ correct: 12, total: 10 })).toEqual({
      pct: 100,
      correct: 10,
      mistakes: 0,
    });
  });
});

describe("milestoneBadge", () => {
  it("names the 30-day badge", () => {
    expect(milestoneBadge(30).name).toBe("Maand-monster");
  });

  it("picks the highest threshold the streak has crossed", () => {
    expect(milestoneBadge(120).name).toBe("Eeuweling");
    expect(milestoneBadge(365).name).toBe("Jaar-held");
  });

  it("falls back to the week badge below 14 days", () => {
    expect(milestoneBadge(7).name).toBe("Week-winnaar");
  });
});
