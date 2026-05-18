/**
 * Integration tests for enqueueVocabPairMistake: pairs land in spaced_rep_queue
 * under itemType "vocab_pair", lowercased key, payload carries nl/en.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { enqueueVocabPairMistake } from "../spaced-rep";
import { asD1, makeTestDb, seedUser } from "./test-db";
import type { TestDb } from "./test-db";
import { eq } from "drizzle-orm";
import { spacedRepQueue } from "../../../db/schema";

describe("enqueueVocabPairMistake (integration: in-memory D1)", () => {
  let drz: TestDb;
  let userId: number;

  beforeEach(() => {
    drz = makeTestDb();
    userId = seedUser(drz);
  });

  it("inserts a fresh vocab_pair row keyed by lowercased nl|en", async () => {
    await enqueueVocabPairMistake(asD1(drz), userId, {
      nl: "Huis",
      en: "House",
      exerciseId: 99,
    });

    const rows = await drz
      .select()
      .from(spacedRepQueue)
      .where(eq(spacedRepQueue.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].itemType).toBe("vocab_pair");
    expect(rows[0].itemKey).toBe("huis|house");
    expect(rows[0].payload).toEqual({ nl: "Huis", en: "House", exerciseId: 99 });
  });

  it("de-dupes repeated mistakes on the same pair (and decays ease)", async () => {
    await enqueueVocabPairMistake(asD1(drz), userId, {
      nl: "boom",
      en: "tree",
      exerciseId: 1,
    });
    await enqueueVocabPairMistake(asD1(drz), userId, {
      nl: "boom",
      en: "tree",
      exerciseId: 2,
    });

    const rows = await drz
      .select()
      .from(spacedRepQueue)
      .where(eq(spacedRepQueue.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].easeFactor).toBeLessThan(2.5);
    expect(rows[0].payload).toMatchObject({ exerciseId: 2 });
  });

  it("treats different pairs as distinct rows", async () => {
    await enqueueVocabPairMistake(asD1(drz), userId, { nl: "huis", en: "house", exerciseId: 1 });
    await enqueueVocabPairMistake(asD1(drz), userId, { nl: "boom", en: "tree", exerciseId: 1 });
    const rows = await drz
      .select()
      .from(spacedRepQueue)
      .where(eq(spacedRepQueue.userId, userId));
    expect(rows).toHaveLength(2);
    const keys = rows.map((r) => r.itemKey).sort();
    expect(keys).toEqual(["boom|tree", "huis|house"]);
  });
});
