import { describe, expect, it } from "vitest";
import { pickCelebration } from "../app.lesson.$lessonId.complete";

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
