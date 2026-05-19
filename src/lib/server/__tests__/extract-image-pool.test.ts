import { describe, it, expect } from "vitest";
import { extractImagePool } from "../lesson";

/**
 * `extractImagePool` is the loader-side helper that flattens every
 * `image-word` row in a unit into a `{nl, en, imageUrl}` pool the
 * picture-choice drill samples distractors from. It must:
 * - drop rows without an imageUrl,
 * - pick the first acceptable Dutch surface form when `answer` is an array,
 * - dedupe by lowercased Dutch noun,
 * - and never throw on malformed rows.
 */
describe("extractImagePool", () => {
  it("collects {nl, en, imageUrl} from image-word rows", () => {
    const rows = [
      { answer: "huis", imageUrl: "https://images/huis.png" },
      { answer: ["kat", "de kat"], imageUrl: "https://images/kat.png" },
    ];
    expect(extractImagePool(rows)).toEqual([
      { nl: "huis", en: "", imageUrl: "https://images/huis.png" },
      { nl: "kat", en: "", imageUrl: "https://images/kat.png" },
    ]);
  });

  it("drops rows without an imageUrl", () => {
    const rows = [
      { answer: "huis", imageUrl: null },
      { answer: "kat", imageUrl: "https://images/kat.png" },
    ];
    expect(extractImagePool(rows)).toEqual([
      { nl: "kat", en: "", imageUrl: "https://images/kat.png" },
    ]);
  });

  it("dedupes by lowercased Dutch noun (keeps first imageUrl)", () => {
    const rows = [
      { answer: "Huis", imageUrl: "https://images/huis-1.png" },
      { answer: "huis", imageUrl: "https://images/huis-2.png" },
    ];
    const pool = extractImagePool(rows);
    expect(pool).toHaveLength(1);
    expect(pool[0].imageUrl).toBe("https://images/huis-1.png");
  });

  it("accepts JSON-stringified answer payloads", () => {
    const rows = [
      { answer: JSON.stringify(["boom", "de boom"]), imageUrl: "https://images/boom.png" },
    ];
    expect(extractImagePool(rows)).toEqual([
      { nl: "boom", en: "", imageUrl: "https://images/boom.png" },
    ]);
  });

  it("skips malformed answers gracefully", () => {
    const rows = [
      { answer: null, imageUrl: "https://images/null.png" },
      { answer: 42, imageUrl: "https://images/num.png" },
      { answer: [], imageUrl: "https://images/empty.png" },
      { answer: "hond", imageUrl: "https://images/hond.png" },
    ];
    expect(extractImagePool(rows)).toEqual([
      { nl: "hond", en: "", imageUrl: "https://images/hond.png" },
    ]);
  });

  it("handles empty input", () => {
    expect(extractImagePool([])).toEqual([]);
  });
});
