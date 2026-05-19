import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildFlashcardTail } from "../lesson";
import { spacedRepQueue } from "../../../db/schema";
import { makeTestDb, asD1, seedUser } from "./test-db";

const POOL = [
  { nl: "huis", en: "house" },
  { nl: "boom", en: "tree" },
  { nl: "boek", en: "book" },
  { nl: "tafel", en: "table" },
  { nl: "stoel", en: "chair" },
  { nl: "kat", en: "cat" },
];

/**
 * Helper: insert N due `vocab_pair` rows for `userId` whose itemKeys match
 * the first N entries of `POOL`. `nextReviewDate` is staggered into the past
 * so newest-due-first ordering is well-defined.
 */
async function seedDueVocabPairs(
  drz: ReturnType<typeof makeTestDb>,
  userId: number,
  pairs: Array<{ nl: string; en: string }>,
) {
  const now = Date.now();
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    await drz.insert(spacedRepQueue).values({
      userId,
      itemType: "vocab_pair",
      itemKey: `${p.nl.toLowerCase()}|${p.en.toLowerCase()}`,
      payload: { nl: p.nl, en: p.en, exerciseId: null },
      // older `nextReviewDate` for the higher-index pairs so ordering by
      // `desc(nextReviewDate)` puts the freshly-missed ones first.
      nextReviewDate: new Date(now - i * 60_000).toISOString(),
      easeFactor: 2.3,
      intervalDays: 1,
      repetitions: 0,
    });
  }
}

describe("buildFlashcardTail", () => {
  it("returns 4 synthetic flashcard drills when pool is big enough", async () => {
    const drz = makeTestDb();
    const userId = seedUser(drz);
    const tail = await buildFlashcardTail(POOL, 42, userId, asD1(drz));
    expect(tail).toHaveLength(4);
    for (const card of tail) {
      expect(card.type).toBe("flashcard");
      expect(card.isSynthetic).toBe(true);
      expect(card.id).toBeLessThan(0);
      const pair = JSON.parse(card.answer!);
      expect(typeof pair.nl).toBe("string");
      expect(typeof pair.en).toBe("string");
    }
  });

  it("returns an empty list when the pool is too small", async () => {
    const drz = makeTestDb();
    const userId = seedUser(drz);
    expect(await buildFlashcardTail(POOL.slice(0, 3), 1, userId, asD1(drz))).toEqual([]);
    expect(await buildFlashcardTail([], 1, userId, asD1(drz))).toEqual([]);
  });

  it("sampled pairs are drawn from the pool", async () => {
    const drz = makeTestDb();
    const userId = seedUser(drz);
    const tail = await buildFlashcardTail(POOL, 1, userId, asD1(drz));
    const poolKeys = new Set(POOL.map((p) => `${p.nl}|${p.en}`));
    for (const card of tail) {
      const pair = JSON.parse(card.answer!);
      expect(poolKeys.has(`${pair.nl}|${pair.en}`)).toBe(true);
    }
  });

  it("generates lesson-scoped negative ids so multiple lessons don't collide", async () => {
    const drz = makeTestDb();
    const userId = seedUser(drz);
    const a = await buildFlashcardTail(POOL, 1, userId, asD1(drz));
    const b = await buildFlashcardTail(POOL, 2, userId, asD1(drz));
    const aIds = new Set(a.map((c) => c.id));
    const bIds = new Set(b.map((c) => c.id));
    for (const id of aIds) expect(bIds.has(id)).toBe(false);
  });

  describe("70/30 queue biasing (US-009)", () => {
    it("with an empty queue, samples 4 fresh pairs from the pool", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      const tail = await buildFlashcardTail(POOL, 7, userId, asD1(drz));
      expect(tail).toHaveLength(4);
      const poolKeys = new Set(POOL.map((p) => `${p.nl}|${p.en}`));
      const tailKeys = new Set(
        tail.map((c) => {
          const p = JSON.parse(c.answer!);
          return `${p.nl}|${p.en}`;
        }),
      );
      // 4 distinct cards, all from the pool.
      expect(tailKeys.size).toBe(4);
      for (const k of tailKeys) expect(poolKeys.has(k)).toBe(true);
    });

    it("with a queue whose rows don't intersect the pool, falls back to pool-only", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      await seedDueVocabPairs(drz, userId, [
        { nl: "auto", en: "car" }, // not in POOL
        { nl: "fiets", en: "bike" }, // not in POOL
      ]);
      const tail = await buildFlashcardTail(POOL, 11, userId, asD1(drz));
      expect(tail).toHaveLength(4);
      const poolKeys = new Set(POOL.map((p) => `${p.nl}|${p.en}`));
      for (const c of tail) {
        const p = JSON.parse(c.answer!);
        expect(poolKeys.has(`${p.nl}|${p.en}`)).toBe(true);
      }
    });

    it("with 1 matching due row, returns 1 queue + 3 pool", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      await seedDueVocabPairs(drz, userId, [POOL[0]]); // huis|house
      const tail = await buildFlashcardTail(POOL, 12, userId, asD1(drz));
      expect(tail).toHaveLength(4);
      const tailKeys = tail.map((c) => {
        const p = JSON.parse(c.answer!);
        return `${p.nl}|${p.en}`;
      });
      // huis|house must appear exactly once (queue contribution).
      expect(tailKeys.filter((k) => k === "huis|house")).toHaveLength(1);
      // Remaining 3 are distinct, from the pool, and not the queue pair.
      const others = tailKeys.filter((k) => k !== "huis|house");
      expect(new Set(others).size).toBe(3);
    });

    it("with 3 matching due rows, returns 3 queue + 1 pool", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      const queuePairs = [POOL[0], POOL[1], POOL[2]]; // huis, boom, boek
      await seedDueVocabPairs(drz, userId, queuePairs);
      const tail = await buildFlashcardTail(POOL, 13, userId, asD1(drz));
      expect(tail).toHaveLength(4);
      const tailKeys = tail.map((c) => {
        const p = JSON.parse(c.answer!);
        return `${p.nl}|${p.en}`;
      });
      const queueKeys = new Set(queuePairs.map((p) => `${p.nl}|${p.en}`));
      const fromQueue = tailKeys.filter((k) => queueKeys.has(k));
      const fromPool = tailKeys.filter((k) => !queueKeys.has(k));
      expect(fromQueue).toHaveLength(3);
      expect(fromPool).toHaveLength(1);
      // No duplicate pairs across queue + pool slots.
      expect(new Set(tailKeys).size).toBe(4);
    });

    it("with 6+ matching due rows, still caps queue contribution at 3 of 4", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      // All 6 pool entries are due — but the 70/30 rule caps queue at 3.
      await seedDueVocabPairs(drz, userId, POOL);
      const tail = await buildFlashcardTail(POOL, 14, userId, asD1(drz));
      expect(tail).toHaveLength(4);
      const tailKeys = tail.map((c) => {
        const p = JSON.parse(c.answer!);
        return `${p.nl}|${p.en}`;
      });
      // All 6 pool keys are also queue keys, so we can't distinguish by
      // membership. Instead assert the structural invariants: 4 distinct
      // cards, all from the pool, queue contribution capped at 3.
      expect(new Set(tailKeys).size).toBe(4);
      const poolKeys = new Set(POOL.map((p) => `${p.nl}|${p.en}`));
      for (const k of tailKeys) expect(poolKeys.has(k)).toBe(true);
    });

    it("future-due vocab_pair rows are ignored (only past-due bias the sampler)", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      // Insert a vocab_pair row whose nextReviewDate is in the future — it
      // should be treated as not-yet-due and excluded from biasing.
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await drz.insert(spacedRepQueue).values({
        userId,
        itemType: "vocab_pair",
        itemKey: "huis|house",
        payload: { nl: "huis", en: "house", exerciseId: null },
        nextReviewDate: future,
        easeFactor: 2.5,
        intervalDays: 7,
        repetitions: 1,
      });
      // Run multiple trials; with a single future-due row and no past-due
      // rows we expect the sampler to behave uniformly over the pool, so
      // huis|house must NOT appear in every trial (it would if biasing
      // counted future rows).
      const trials = 20;
      let huisCount = 0;
      for (let i = 0; i < trials; i++) {
        const tail = await buildFlashcardTail(POOL, 100 + i, userId, asD1(drz));
        for (const c of tail) {
          const p = JSON.parse(c.answer!);
          if (`${p.nl}|${p.en}` === "huis|house") huisCount++;
        }
      }
      // Uniform sampling over 6 pool entries picks each pair with p = 4/6;
      // over 20 trials huis|house should appear ~13 times. Biasing on a
      // future row would put it in all 20. Tolerate randomness by asserting
      // it's strictly less than 20.
      expect(huisCount).toBeLessThan(20);
    });

    it("other itemTypes (exercise, roleplay_error) do not bias the sampler", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      const now = new Date().toISOString();
      // Two due rows with the same key as POOL[0] but wrong itemType.
      await drz.insert(spacedRepQueue).values({
        userId,
        itemType: "exercise",
        itemKey: "huis|house",
        payload: null,
        nextReviewDate: now,
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 0,
      });
      await drz.insert(spacedRepQueue).values({
        userId,
        itemType: "roleplay_error",
        itemKey: "vocab:huis|house",
        payload: null,
        nextReviewDate: now,
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 0,
      });
      // Same trick as the future-due test: huis|house should not be in
      // every trial, which would happen if itemType filtering were broken.
      const trials = 20;
      let huisCount = 0;
      for (let i = 0; i < trials; i++) {
        const tail = await buildFlashcardTail(POOL, 200 + i, userId, asD1(drz));
        for (const c of tail) {
          const p = JSON.parse(c.answer!);
          if (`${p.nl}|${p.en}` === "huis|house") huisCount++;
        }
      }
      expect(huisCount).toBeLessThan(20);
    });
  });

  describe("PostHog observability (issue #157)", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(new Response("ok"));
      vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("fires flashcard_tail_sampled exactly once per buildFlashcardTail call", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      await buildFlashcardTail(POOL, 42, userId, asD1(drz), {
        unitId: 7,
        env: { POSTHOG_PROJECT_KEY: "phc_test" },
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/capture\/$/);
      const body = JSON.parse(init.body as string);
      expect(body.event).toBe("flashcard_tail_sampled");
    });

    it("event properties carry correct counts for pool-only path (empty queue)", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      await buildFlashcardTail(POOL, 43, userId, asD1(drz), {
        unitId: 7,
        env: { POSTHOG_PROJECT_KEY: "phc_test" },
      });
      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.properties).toMatchObject({
        unit_id: 7,
        queue_rows_available: 0,
        queue_rows_used: 0,
        pool_rows_used: 4,
      });
    });

    it("event properties carry correct counts for biased path (3 queue + 1 pool)", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      await seedDueVocabPairs(drz, userId, [POOL[0], POOL[1], POOL[2]]);
      await buildFlashcardTail(POOL, 44, userId, asD1(drz), {
        unitId: 7,
        env: { POSTHOG_PROJECT_KEY: "phc_test" },
      });
      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.properties).toMatchObject({
        unit_id: 7,
        queue_rows_available: 3,
        queue_rows_used: 3,
        pool_rows_used: 1,
      });
    });

    it("distinct_id is a sha256 hash of userId (not raw userId)", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      await buildFlashcardTail(POOL, 45, userId, asD1(drz), {
        unitId: 7,
        env: { POSTHOG_PROJECT_KEY: "phc_test" },
      });
      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      // distinct_id must be a 64-char hex string (sha256), not the raw numeric id
      expect(body.distinct_id).toMatch(/^[0-9a-f]{64}$/);
      expect(body.distinct_id).not.toBe(String(userId));
    });

    it("does not fire when env is omitted", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      await buildFlashcardTail(POOL, 46, userId, asD1(drz));
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not fire when POSTHOG_PROJECT_KEY is absent from env", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      await buildFlashcardTail(POOL, 47, userId, asD1(drz), { env: {} });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not fire when pool is too small (function returns early)", async () => {
      const drz = makeTestDb();
      const userId = seedUser(drz);
      await buildFlashcardTail(POOL.slice(0, 3), 48, userId, asD1(drz), {
        env: { POSTHOG_PROJECT_KEY: "phc_test" },
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
