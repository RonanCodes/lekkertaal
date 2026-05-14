/**
 * Vault snapshot test for the B1 starter curriculum (P2-CON-2).
 *
 * Reads every JSON file under seed/curriculum/b1/ and asserts:
 *   - exactly 10 units (one file per unit)
 *   - total drill count is in the 100-200 range (15 drills/unit target = 150)
 *   - every drill has canonical_dutch, expected_english, audio_voice_id
 *   - unit ordering is stable via numeric filename prefix
 *   - every drill type maps to a recognised renderer type
 *   - at least 4 speak drills per unit (B1 raises the bar over A1's 2)
 *   - each unit has at least 1 scenario entry linking back via unit_slug
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const CURRICULUM_DIR = resolve(__dirname, "../../../seed/curriculum/b1");
const SCENARIOS_FILE = resolve(__dirname, "../../../seed/scenarios.json");
const KNOWN_DRILL_TYPES = new Set(["translate", "multipleChoice", "fillBlank", "speak"]);

type Drill = {
  slug: string;
  type: string;
  canonical_dutch: string;
  expected_english: string;
  audio_voice_id: string;
};

type Unit = {
  unit: {
    slug: string;
    title_nl: string;
    title_en: string;
    cefr_level: string;
    order: number;
  };
  drills: Drill[];
};

type Scenario = {
  slug: string;
  unit_slug: string;
  difficulty: string;
};

function loadUnits(): Array<{ filename: string; data: Unit }> {
  const files = readdirSync(CURRICULUM_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.map((filename) => ({
    filename,
    data: JSON.parse(readFileSync(join(CURRICULUM_DIR, filename), "utf8")) as Unit,
  }));
}

function loadScenarios(): Scenario[] {
  return JSON.parse(readFileSync(SCENARIOS_FILE, "utf8")) as Scenario[];
}

describe("B1 starter curriculum (P2-CON-2)", () => {
  const units = loadUnits();
  const scenarios = loadScenarios();

  it("has exactly 10 units", () => {
    expect(units).toHaveLength(10);
  });

  it("uses B1 cefr_level on every unit", () => {
    for (const { data } of units) {
      expect(data.unit.cefr_level).toBe("B1");
    }
  });

  it("orders units stably via numeric filename prefix matching unit.order", () => {
    for (const { filename, data } of units) {
      const prefix = Number(filename.slice(0, 2));
      expect(prefix).toBe(data.unit.order);
    }
    const orders = units.map((u) => u.data.unit.order);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("has unique unit slugs", () => {
    const slugs = units.map((u) => u.data.unit.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has 10-20 drills per unit", () => {
    for (const { data } of units) {
      expect(data.drills.length).toBeGreaterThanOrEqual(10);
      expect(data.drills.length).toBeLessThanOrEqual(20);
    }
  });

  it("has a total drill count near 150 (100-200 inclusive)", () => {
    const total = units.reduce((acc, u) => acc + u.data.drills.length, 0);
    expect(total).toBeGreaterThanOrEqual(100);
    expect(total).toBeLessThanOrEqual(200);
    // Target is 150 (guard against drift if someone adds/removes a few).
    expect(total).toBe(150);
  });

  it("has at least 4 speak drills per unit (B1 raises the bar)", () => {
    for (const { data } of units) {
      const speakCount = data.drills.filter((d) => d.type === "speak").length;
      expect(speakCount, `${data.unit.slug} speak drills`).toBeGreaterThanOrEqual(4);
    }
  });

  it("fills canonical_dutch, expected_english, audio_voice_id on every drill", () => {
    for (const { data } of units) {
      for (const drill of data.drills) {
        expect(drill.canonical_dutch, `${drill.slug} canonical_dutch`).toBeTruthy();
        expect(drill.expected_english, `${drill.slug} expected_english`).toBeTruthy();
        expect(drill.audio_voice_id, `${drill.slug} audio_voice_id`).toBeTruthy();
      }
    }
  });

  it("uses only known drill types", () => {
    for (const { data } of units) {
      for (const drill of data.drills) {
        expect(KNOWN_DRILL_TYPES.has(drill.type), `unknown type ${drill.type} on ${drill.slug}`).toBe(true);
      }
    }
  });

  it("has globally unique drill slugs", () => {
    const allSlugs = units.flatMap((u) => u.data.drills.map((d) => d.slug));
    expect(new Set(allSlugs).size).toBe(allSlugs.length);
  });

  it("links each unit to at least 1 boss-fight scenario via unit_slug", () => {
    const b1Scenarios = scenarios.filter((s) => s.difficulty === "B1");
    for (const { data } of units) {
      const matching = b1Scenarios.filter((s) => s.unit_slug === data.unit.slug);
      expect(matching.length, `${data.unit.slug} should have ≥1 B1 scenario`).toBeGreaterThanOrEqual(1);
    }
  });
});
