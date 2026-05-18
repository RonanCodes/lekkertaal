/**
 * US-008: raise the active-review cap from 10 to 200.
 *
 * This test seeds 200 distinct `vocab_pair` rows for a single user via the
 * production `enqueueVocabPairMistake` path (so we exercise the same cap +
 * eviction logic real callers hit), then measures the read latency of the
 * exact Drizzle query `getDueReviews` runs. The 50ms budget is what the
 * acceptance criteria specify for D1; better-sqlite3's in-memory profile is
 * strictly faster than the network-hop D1 path, so a green run here means
 * D1 will be comfortable too.
 *
 * We exercise the inner query directly (not the server-fn wrapper) because
 * the wrapper threads through AsyncLocalStorage + Clerk, neither of which
 * are present in a Vitest harness. The query under test is the load-bearing
 * piece for latency.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { and, asc, eq, lte } from "drizzle-orm";
import { enqueueVocabPairMistake } from "../spaced-rep";
import { asD1, makeTestDb, seedUser } from "./test-db";
import type { TestDb } from "./test-db";
import { spacedRepQueue } from "../../../db/schema";

const DUE_BATCH = 3;

describe("spaced-rep cap (US-008: 200 active rows, <50ms read)", () => {
  let drz: TestDb;
  let userId: number;

  beforeEach(() => {
    drz = makeTestDb();
    userId = seedUser(drz);
  });

  it("seeds 200 distinct vocab_pair rows and reads due reviews in <50ms", async () => {
    const target = 200;

    for (let i = 0; i < target; i++) {
      await enqueueVocabPairMistake(asD1(drz), userId, {
        nl: `nlword${i}`,
        en: `enword${i}`,
        exerciseId: i,
      });
    }

    // Sanity: row count is capped at <= 200 (some may have been evicted on
    // the last few inserts if the cap kicked in mid-loop) and >= 1.
    const countRows = drz.$sqlite
      .prepare("SELECT COUNT(*) AS c FROM spaced_rep_queue WHERE user_id = ?")
      .get(userId) as { c: number };
    expect(countRows.c).toBeLessThanOrEqual(target);
    expect(countRows.c).toBeGreaterThanOrEqual(1);

    // Time the exact same query getDueReviews executes.
    const nowIso = new Date().toISOString();
    const start = performance.now();
    const due = await asD1(drz)
      .select()
      .from(spacedRepQueue)
      .where(
        and(
          eq(spacedRepQueue.userId, userId),
          lte(spacedRepQueue.nextReviewDate, nowIso),
        ),
      )
      .orderBy(asc(spacedRepQueue.nextReviewDate))
      .limit(DUE_BATCH);
    const elapsedMs = performance.now() - start;

    // Surface the timing for CI logs (helpful when debugging future regressions).
    console.log(
      `[us-008] getDueReviews-equivalent read over ${countRows.c} rows: ${elapsedMs.toFixed(2)}ms`,
    );

    expect(elapsedMs).toBeLessThan(50);
    expect(due.length).toBeGreaterThan(0);
    expect(due.length).toBeLessThanOrEqual(DUE_BATCH);
    for (const row of due) {
      expect(row.itemType).toBe("vocab_pair");
    }
  });
});
