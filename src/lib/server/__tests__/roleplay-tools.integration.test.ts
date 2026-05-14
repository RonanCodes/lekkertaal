/**
 * Integration tests for the roleplay in-chat tools (US-AI-SDK-4).
 *
 * Exercises the pure-function execute bodies (`executeLookupVocab`,
 * `executeFlagSuspectedError`) against the in-memory D1 harness so the
 * real schema + real Drizzle queries participate.
 *
 * What we care about:
 *   - lookupVocab hits on exact-match nl
 *   - lookupVocab falls back to lower-case match
 *   - lookupVocab returns { found: false } on miss (does NOT throw)
 *   - flagSuspectedError writes a roleplay_errors row with the right shape
 *   - flagSuspectedError no-ops when sessionId is null
 *   - flagSuspectedError no-ops on empty input
 *
 * The Zod schema shape of the published tool objects is also asserted so
 * any rename / signature drift breaks the test rather than silently
 * confusing the model.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  buildRoleplayTools,
  executeFlagSuspectedError,
  executeLookupVocab,
} from "../roleplay-tools";
import { roleplayErrors, roleplaySessions, scenarios, users, vocab } from "../../../db/schema";
import { makeTestDb, asD1, type TestDb } from "./test-db";

function seedScenario(drz: TestDb, slug = "bij-de-bakker"): number {
  const result = drz.$sqlite
    .prepare(
      `INSERT INTO scenarios
       (slug, title_nl, title_en, difficulty, npc_name, npc_persona, opening_nl)
       VALUES (?, 'Bij de bakker', 'At the bakers', 'A2', 'Marieke',
               'Friendly baker', 'Goedemorgen!')`,
    )
    .run(slug);
  return Number(result.lastInsertRowid);
}

function seedSession(drz: TestDb, userId: number, scenarioId: number): number {
  const result = drz.$sqlite
    .prepare(
      `INSERT INTO roleplay_sessions (user_id, scenario_id) VALUES (?, ?)`,
    )
    .run(userId, scenarioId);
  return Number(result.lastInsertRowid);
}

describe("roleplay-tools (integration: in-memory D1)", () => {
  let drz: TestDb;
  let userId: number;
  let scenarioId: number;
  let sessionId: number;

  beforeEach(() => {
    drz = makeTestDb();
    const userRow = drz.$sqlite
      .prepare(
        `INSERT INTO users (clerk_id, email, display_name) VALUES (?, ?, ?)`,
      )
      .run("clerk_test", "t@example.test", "tester");
    userId = Number(userRow.lastInsertRowid);
    scenarioId = seedScenario(drz);
    sessionId = seedSession(drz, userId, scenarioId);

    // Seed a handful of vocab rows.
    drz.$sqlite
      .prepare(
        `INSERT INTO vocab (nl, en, example_sentence_nl, example_sentence_en, cefr_level)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run("brood", "bread", "Ik wil een brood.", "I want a loaf.", "A1");
    drz.$sqlite
      .prepare(
        `INSERT INTO vocab (nl, en, cefr_level) VALUES (?, ?, ?)`,
      )
      .run("alstublieft", "please", "A2");
  });

  describe("executeLookupVocab", () => {
    it("returns the row on exact nl match", async () => {
      const r = await executeLookupVocab({ drz: asD1(drz) }, "brood");
      expect(r.found).toBe(true);
      if (r.found) {
        expect(r.nl).toBe("brood");
        expect(r.en).toBe("bread");
        expect(r.exampleSentenceNl).toBe("Ik wil een brood.");
        expect(r.cefrLevel).toBe("A1");
      }
    });

    it("falls back to lower-case match when the input is capitalised", async () => {
      const r = await executeLookupVocab({ drz: asD1(drz) }, "Brood");
      expect(r.found).toBe(true);
      if (r.found) expect(r.nl).toBe("brood");
    });

    it("trims whitespace before looking up", async () => {
      const r = await executeLookupVocab({ drz: asD1(drz) }, "  brood  ");
      expect(r.found).toBe(true);
    });

    it("returns { found: false } on miss without throwing", async () => {
      const r = await executeLookupVocab({ drz: asD1(drz) }, "kazerne");
      expect(r.found).toBe(false);
      if (!r.found) expect(r.word).toBe("kazerne");
    });

    it("returns { found: false } on empty input", async () => {
      const r = await executeLookupVocab({ drz: asD1(drz) }, "   ");
      expect(r.found).toBe(false);
    });
  });

  describe("executeFlagSuspectedError", () => {
    it("inserts a roleplay_errors row and returns the new id", async () => {
      const r = await executeFlagSuspectedError(
        { drz: asD1(drz), userId, sessionId },
        {
          category: "grammar",
          incorrect: "ik ben gaan",
          correction: "ik ga",
          explanationEn: "Present tense, not perfect.",
        },
      );
      expect(r.recorded).toBe(true);
      if (!r.recorded) throw new Error("expected recorded");

      const rows = await drz
        .select()
        .from(roleplayErrors)
        .where(eq(roleplayErrors.id, r.errorId));
      expect(rows).toHaveLength(1);
      expect(rows[0].sessionId).toBe(sessionId);
      expect(rows[0].userId).toBe(userId);
      expect(rows[0].category).toBe("grammar");
      expect(rows[0].incorrect).toBe("ik ben gaan");
      expect(rows[0].correction).toBe("ik ga");
      expect(rows[0].explanationEn).toBe("Present tense, not perfect.");
    });

    it("no-ops when sessionId is null", async () => {
      const r = await executeFlagSuspectedError(
        { drz: asD1(drz), userId, sessionId: null },
        { category: "vocab", incorrect: "x", correction: "y" },
      );
      expect(r.recorded).toBe(false);
      if (!r.recorded) expect(r.reason).toBe("no_session");

      const rows = await drz.select().from(roleplayErrors);
      expect(rows).toHaveLength(0);
    });

    it("no-ops on empty input", async () => {
      const r = await executeFlagSuspectedError(
        { drz: asD1(drz), userId, sessionId },
        { category: "spelling", incorrect: "   ", correction: "y" },
      );
      expect(r.recorded).toBe(false);
      if (!r.recorded) expect(r.reason).toBe("empty_input");
    });

    it("stores explanationEn as null when omitted", async () => {
      const r = await executeFlagSuspectedError(
        { drz: asD1(drz), userId, sessionId },
        { category: "register", incorrect: "u bent leuk", correction: "je bent leuk" },
      );
      expect(r.recorded).toBe(true);
      if (!r.recorded) throw new Error("expected recorded");

      const rows = await drz
        .select()
        .from(roleplayErrors)
        .where(eq(roleplayErrors.id, r.errorId));
      expect(rows[0].explanationEn).toBeNull();
    });
  });

  describe("buildRoleplayTools", () => {
    it("publishes both tools with the expected names", () => {
      const tools = buildRoleplayTools({
        drz: asD1(drz),
        userId,
        sessionId,
      });
      expect(Object.keys(tools).sort()).toEqual(
        ["flagSuspectedError", "lookupVocab"],
      );
    });

    it("lookupVocab tool description mentions the vocab deck", () => {
      const tools = buildRoleplayTools({
        drz: asD1(drz),
        userId,
        sessionId,
      });
      expect(tools.lookupVocab.description).toMatch(/Dutch word/);
      expect(tools.lookupVocab.description).toMatch(/vocab deck/);
    });

    it("flagSuspectedError description tells the model to stay silent", () => {
      const tools = buildRoleplayTools({
        drz: asD1(drz),
        userId,
        sessionId,
      });
      expect(tools.flagSuspectedError.description).toMatch(/[Ss]ilently/);
    });
  });
});
