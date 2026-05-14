/**
 * Integration tests for the gamification + spaced-rep server helpers.
 *
 * Runs each helper against an in-memory SQLite DB (better-sqlite3) using the
 * production Drizzle schema and migrations. No Clerk / CF Workers runtime
 * involved — we exercise the pure DB-side logic.
 *
 * Date handling: `bumpStreakIfFirstToday` calls `new Date()` directly. To
 * test "yesterday was active" or "user missed N days" branches we seed
 * `streak_last_active_date` to a known offset from today and let the helper
 * compute today/yesterday itself.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  awardLessonComplete,
  resetStaleStreaks,
  LESSON_XP_REWARD,
  LESSON_COIN_REWARD,
} from "../gamification";
import { enqueueDrillMistake } from "../spaced-rep";
import { makeTestDb, asD1, seedUser  } from "./test-db";
import type {TestDb} from "./test-db";
import { eq } from "drizzle-orm";
import { users, spacedRepQueue, xpEvents, coinEvents, dailyCompletions } from "../../../db/schema";

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe("gamification (integration: in-memory D1)", () => {
  let drz: TestDb;

  beforeEach(() => {
    drz = makeTestDb();
  });

  describe("awardLessonComplete", () => {
    it("awards 20 XP + 5 coins and starts streak on a first-ever lesson", async () => {
      const userId = seedUser(drz);

      const result = await awardLessonComplete(asD1(drz), userId, 42, false);

      expect(result.xpAwarded).toBe(LESSON_XP_REWARD);
      expect(result.coinsAwarded).toBe(LESSON_COIN_REWARD);
      expect(result.streakDays).toBe(1);
      expect(result.freezeUsed).toBe(false);

      // User row updated.
      const me = await drz.select().from(users).where(eq(users.id, userId));
      expect(me[0].xpTotal).toBe(LESSON_XP_REWARD);
      expect(me[0].coinsBalance).toBe(LESSON_COIN_REWARD);
      expect(me[0].streakDays).toBe(1);
      expect(me[0].streakLastActiveDate).toBe(isoDate(0));

      // Audit trail rows present.
      const xp = await drz.select().from(xpEvents).where(eq(xpEvents.userId, userId));
      expect(xp).toHaveLength(1);
      expect(xp[0].delta).toBe(LESSON_XP_REWARD);
      expect(xp[0].reason).toBe("lesson_complete");

      const coins = await drz.select().from(coinEvents).where(eq(coinEvents.userId, userId));
      expect(coins).toHaveLength(1);
      expect(coins[0].delta).toBe(LESSON_COIN_REWARD);

      // Daily completion row.
      const daily = await drz.select().from(dailyCompletions).where(eq(dailyCompletions.userId, userId));
      expect(daily).toHaveLength(1);
      expect(daily[0].lessonsCompleted).toBe(1);
      expect(daily[0].xpEarned).toBe(LESSON_XP_REWARD);
    });

    it("does NOT double-increment the streak when called twice on the same day", async () => {
      const userId = seedUser(drz);

      const first = await awardLessonComplete(asD1(drz), userId, 1, false);
      expect(first.streakDays).toBe(1);

      const second = await awardLessonComplete(asD1(drz), userId, 2, false);
      // Still day 1 — same UTC day.
      expect(second.streakDays).toBe(1);

      // But XP keeps stacking (two lesson completions = 40 XP, 10 coins).
      const me = await drz.select().from(users).where(eq(users.id, userId));
      expect(me[0].xpTotal).toBe(LESSON_XP_REWARD * 2);
      expect(me[0].coinsBalance).toBe(LESSON_COIN_REWARD * 2);
      expect(me[0].streakDays).toBe(1);

      // Daily-completions row should accumulate, not duplicate.
      const daily = await drz.select().from(dailyCompletions).where(eq(dailyCompletions.userId, userId));
      expect(daily).toHaveLength(1);
      expect(daily[0].lessonsCompleted).toBe(2);
      expect(daily[0].xpEarned).toBe(LESSON_XP_REWARD * 2);
    });

    it("increments the streak when yesterday was the last active day", async () => {
      const userId = seedUser(drz, {
        streakDays: 5,
        streakLastActiveDate: isoDate(-1),
      });

      const result = await awardLessonComplete(asD1(drz), userId, 99, false);

      expect(result.streakDays).toBe(6);
      expect(result.freezeUsed).toBe(false);

      const me = await drz.select().from(users).where(eq(users.id, userId));
      expect(me[0].streakDays).toBe(6);
      expect(me[0].streakLastActiveDate).toBe(isoDate(0));
    });

    it("consumes a freeze and keeps the streak when the gap is > 1 day but a freeze is available", async () => {
      const userId = seedUser(drz, {
        streakDays: 5,
        streakFreezesBalance: 2,
        streakLastActiveDate: isoDate(-3),
      });

      const result = await awardLessonComplete(asD1(drz), userId, 99, false);

      expect(result.streakDays).toBe(6);
      expect(result.freezeUsed).toBe(true);

      const me = await drz.select().from(users).where(eq(users.id, userId));
      expect(me[0].streakFreezesBalance).toBe(1);
      expect(me[0].streakDays).toBe(6);
    });

    it("resets the streak to 1 when the gap is > 1 day and the user has no freezes", async () => {
      const userId = seedUser(drz, {
        streakDays: 10,
        streakFreezesBalance: 0,
        streakLastActiveDate: isoDate(-3),
      });

      const result = await awardLessonComplete(asD1(drz), userId, 99, false);

      expect(result.streakDays).toBe(1);
      expect(result.freezeUsed).toBe(false);
    });
  });

  describe("resetStaleStreaks (cron sweep)", () => {
    it("consumes a freeze for stale users who have one (preserves streak)", async () => {
      const userId = seedUser(drz, {
        streakDays: 7,
        streakFreezesBalance: 1,
        streakLastActiveDate: isoDate(-3),
      });

      const resetCount = await resetStaleStreaks(asD1(drz));

      expect(resetCount).toBe(0); // freeze consumed, not reset
      const me = await drz.select().from(users).where(eq(users.id, userId));
      expect(me[0].streakDays).toBe(7); // preserved
      expect(me[0].streakFreezesBalance).toBe(0);
      expect(me[0].streakLastActiveDate).toBe(isoDate(-1));
    });

    it("resets streak to 0 for stale users with no freezes", async () => {
      const userId = seedUser(drz, {
        streakDays: 12,
        streakFreezesBalance: 0,
        streakLastActiveDate: isoDate(-3),
      });

      const resetCount = await resetStaleStreaks(asD1(drz));

      expect(resetCount).toBe(1);
      const me = await drz.select().from(users).where(eq(users.id, userId));
      expect(me[0].streakDays).toBe(0);
    });

    it("leaves yesterday-active users alone (not stale)", async () => {
      const userId = seedUser(drz, {
        streakDays: 4,
        streakFreezesBalance: 0,
        streakLastActiveDate: isoDate(-1),
      });

      const resetCount = await resetStaleStreaks(asD1(drz));

      expect(resetCount).toBe(0);
      const me = await drz.select().from(users).where(eq(users.id, userId));
      expect(me[0].streakDays).toBe(4);
    });
  });

  describe("spaced-rep enqueue", () => {
    it("enqueueDrillMistake inserts a fresh queue row for an unseen exercise", async () => {
      const userId = seedUser(drz);

      await enqueueDrillMistake(asD1(drz), userId, 123, { question: "ik ben", answer: "ik ben" });

      const rows = await drz
        .select()
        .from(spacedRepQueue)
        .where(eq(spacedRepQueue.userId, userId));
      expect(rows).toHaveLength(1);
      expect(rows[0].itemType).toBe("exercise");
      expect(rows[0].itemKey).toBe("exercise:123");
      expect(rows[0].easeFactor).toBe(2.5);
      expect(rows[0].intervalDays).toBe(1);
      expect(rows[0].repetitions).toBe(0);
    });

    it("enqueueDrillMistake re-bumps an existing row instead of duplicating it (decays ease)", async () => {
      const userId = seedUser(drz);

      await enqueueDrillMistake(asD1(drz), userId, 123, { attempt: 1 });
      // Sneak in: artificially advance the existing row so we can verify the
      // helper re-bumps it back to "due today" rather than leaving it alone.
      await drz
        .update(spacedRepQueue)
        .set({ easeFactor: 2.5, intervalDays: 14, nextReviewDate: new Date(Date.now() + 14 * 86400_000).toISOString() })
        .where(eq(spacedRepQueue.userId, userId));

      await enqueueDrillMistake(asD1(drz), userId, 123, { attempt: 2 });

      const rows = await drz
        .select()
        .from(spacedRepQueue)
        .where(eq(spacedRepQueue.userId, userId));
      expect(rows).toHaveLength(1); // no duplicate
      // Ease decayed by 0.2 (clamped at 1.3 floor).
      expect(rows[0].easeFactor).toBeCloseTo(2.3, 5);
      // Bumped back to "due today" — within a couple of seconds of now.
      const dueDelta = Date.now() - new Date(rows[0].nextReviewDate).getTime();
      expect(Math.abs(dueDelta)).toBeLessThan(5_000);
    });
  });
});
