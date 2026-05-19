import { describe, it, expect } from "vitest";
import { pickWord } from "../wordOfDay";

const SAMPLE = ["a", "b", "c", "d", "e"] as const;

describe("pickWord", () => {
  it("is deterministic for a given date", () => {
    expect(pickWord("2026-05-19", SAMPLE)).toBe(pickWord("2026-05-19", SAMPLE));
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
      const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      expect(SAMPLE).toContain(pickWord(date, SAMPLE));
    }
  });

  it("guarantees no consecutive-day repeats and full coverage within a `wordlist.length` window starting from Jan 1", () => {
    // dayOfYear % length means each word appears exactly once per N-day cycle.
    const fifty = Array.from({ length: 50 }, (_, i) => String(i));
    let prev: string | null = null;
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      const word = pickWord(date, fifty);
      expect(word).not.toBe(prev);
      expect(seen.has(word)).toBe(false);
      seen.add(word);
      prev = word;
    }
    expect(seen.size).toBe(50);
  });

  it("walks the wordlist in order across consecutive UTC days within a year", () => {
    // Day-of-year incrementing by 1 → index incrementing by 1.
    const fifty = Array.from({ length: 50 }, (_, i) => String(i));
    const first = Number(pickWord("2026-01-01", fifty));
    const second = Number(pickWord("2026-01-02", fifty));
    const third = Number(pickWord("2026-01-03", fifty));
    expect(second).toBe((first + 1) % 50);
    expect(third).toBe((first + 2) % 50);
  });

  it("never repeats the same word on two consecutive days within a year", () => {
    // Real-world regression for the user's "today is the same as yesterday"
    // complaint. Walk every day of 2026 (non-leap) and assert no day matches
    // the previous day's pick.
    const fifty = Array.from({ length: 50 }, (_, i) => String(i));
    let prev: string | null = null;
    for (let i = 0; i < 365; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      const word = pickWord(date, fifty);
      expect(word).not.toBe(prev);
      prev = word;
    }
  });
});
