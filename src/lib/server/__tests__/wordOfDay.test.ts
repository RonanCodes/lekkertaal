import { describe, it, expect } from "vitest";
import { pickWord } from "../wordOfDay";

const SAMPLE = ["a", "b", "c", "d", "e"] as const;

describe("pickWord", () => {
  it("is deterministic for a given date", () => {
    const a = pickWord("2026-05-19", SAMPLE);
    const b = pickWord("2026-05-19", SAMPLE);
    expect(a).toBe(b);
  });

  it("produces a different word on a different date (usually)", () => {
    const picks = new Set<string>();
    for (let i = 1; i <= 30; i++) {
      picks.add(pickWord(`2026-05-${String(i).padStart(2, "0")}`, SAMPLE));
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it("always returns a word from the list", () => {
    for (let i = 0; i < 100; i++) {
      const date = new Date(2026, 0, 1 + i).toISOString().slice(0, 10);
      expect(SAMPLE).toContain(pickWord(date, SAMPLE));
    }
  });
});
