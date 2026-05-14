/**
 * Integration tests for the daily-quests engine (P2-CON-3).
 *
 * Exercises seed → progress-bump → claim against an in-memory better-sqlite3
 * D1 harness. Random source is replaced with a fixed sequence so the kind
 * + target selection is deterministic.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  bumpQuestProgress,
  chooseQuestsForToday,
  claimQuest,
  listQuestsForUser,
  runDailyQuestsCron,
  seedQuestsForUser,
  todayInTz,
} from "../daily-quests";
import type { QuestKind } from "../daily-quests";
import { awardLessonComplete } from "../gamification";
import { asD1, makeTestDb, seedUser } from "./test-db";
import type { TestDb } from "./test-db";
import { eq, and } from "drizzle-orm";
import { dailyQuests, users, xpEvents, coinEvents } from "../../../db/schema";

/** Deterministic rand: returns each value in order then loops. */
function seqRand(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

describe("daily-quests engine (integration: in-memory D1)", () => {
  let drz: TestDb;

  beforeEach(() => {
    drz = makeTestDb();
  });

  describe("todayInTz", () => {
    it("formats a fixed instant as YYYY-MM-DD in the given tz", () => {
      // 2026-05-14T22:30:00Z → 2026-05-15 in Asia/Tokyo (+09).
      const fixed = new Date("2026-05-14T22:30:00Z");
      expect(todayInTz("Asia/Tokyo", fixed)).toBe("2026-05-15");
      expect(todayInTz("UTC", fixed)).toBe("2026-05-14");
    });
  });

  describe("chooseQuestsForToday", () => {
    it("returns 3 quests with distinct kinds", () => {
      const rand = seqRand([0, 0, 0, 0, 0, 0]); // always pick first remaining
      const quests = chooseQuestsForToday(1, "2026-05-14", rand);
      expect(quests).toHaveLength(3);
      const kinds = new Set(quests.map((q) => q.kind));
      expect(kinds.size).toBe(3);
    });
  });

  describe("seedQuestsForUser", () => {
    it("inserts 3 rows on first run, 0 on same-day re-run (idempotent)", async () => {
      const userId = seedUser(drz);
      const rand = seqRand([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);

      const first = await seedQuestsForUser(asD1(drz), userId, "UTC", new Date(), rand);
      expect(first).toBe(3);

      const second = await seedQuestsForUser(asD1(drz), userId, "UTC", new Date(), rand);
      expect(second).toBe(0);

      const rows = await drz.select().from(dailyQuests).where(eq(dailyQuests.userId, userId));
      expect(rows).toHaveLength(3);
    });
  });

  describe("runDailyQuestsCron", () => {
    it("seeds quests for every user on first run, no-ops on re-run", async () => {
      const a = seedUser(drz);
      const b = seedUser(drz);

      const first = await runDailyQuestsCron(asD1(drz));
      expect(first.scanned).toBe(2);
      expect(first.seeded).toBe(2);

      const second = await runDailyQuestsCron(asD1(drz));
      expect(second.scanned).toBe(2);
      expect(second.seeded).toBe(0);

      const aRows = await drz.select().from(dailyQuests).where(eq(dailyQuests.userId, a));
      const bRows = await drz.select().from(dailyQuests).where(eq(dailyQuests.userId, b));
      expect(aRows).toHaveLength(3);
      expect(bRows).toHaveLength(3);
    });
  });

  describe("bumpQuestProgress", () => {
    it("advances progress and flips completed when target reached", async () => {
      const userId = seedUser(drz);
      const today = todayInTz("UTC");
      // Seed one quest directly so we can pick the kind.
      await drz.insert(dailyQuests).values({
        userId,
        date: today,
        kind: "xp" as QuestKind,
        target: 30,
        progress: 0,
      });

      await bumpQuestProgress(asD1(drz), userId, "xp", 20);
      let row = await drz.select().from(dailyQuests).where(eq(dailyQuests.userId, userId));
      expect(row[0].progress).toBe(20);
      expect(row[0].completed).toBe(false);

      await bumpQuestProgress(asD1(drz), userId, "xp", 15);
      row = await drz.select().from(dailyQuests).where(eq(dailyQuests.userId, userId));
      // Capped at target.
      expect(row[0].progress).toBe(30);
      expect(row[0].completed).toBe(true);
    });

    it("does nothing when no quest of the kind exists for today", async () => {
      const userId = seedUser(drz);
      await bumpQuestProgress(asD1(drz), userId, "xp", 99);
      const rows = await drz.select().from(dailyQuests).where(eq(dailyQuests.userId, userId));
      expect(rows).toHaveLength(0);
    });
  });

  describe("awardLessonComplete → quest hooks", () => {
    it("bumps the xp + lessons + streak quests when present", async () => {
      const userId = seedUser(drz);
      const today = todayInTz("UTC");
      // Pre-seed the three relevant quests so we can measure bumps deterministically.
      await drz.insert(dailyQuests).values([
        { userId, date: today, kind: "xp" as QuestKind, target: 30 },
        { userId, date: today, kind: "lessons" as QuestKind, target: 1 },
        { userId, date: today, kind: "streak" as QuestKind, target: 1 },
      ]);

      await awardLessonComplete(asD1(drz), userId, 99, false);

      const rows = await drz.select().from(dailyQuests).where(eq(dailyQuests.userId, userId));
      const byKind = new Map(rows.map((r) => [r.kind, r]));

      expect(byKind.get("xp")!.progress).toBe(20); // LESSON_XP_REWARD
      expect(byKind.get("xp")!.completed).toBe(false);
      expect(byKind.get("lessons")!.progress).toBe(1);
      expect(byKind.get("lessons")!.completed).toBe(true);
      expect(byKind.get("streak")!.progress).toBe(1);
      expect(byKind.get("streak")!.completed).toBe(true);
    });
  });

  describe("claimQuest", () => {
    it("awards bonus XP + coins on a completed quest and marks it claimed", async () => {
      const userId = seedUser(drz);
      const today = todayInTz("UTC");
      const inserted = await drz
        .insert(dailyQuests)
        .values({
          userId,
          date: today,
          kind: "xp" as QuestKind,
          target: 30,
          progress: 30,
          completed: true,
          bonusXp: 15,
          bonusCoins: 5,
        })
        .returning({ id: dailyQuests.id });
      const questId = inserted[0].id;

      const before = (await drz.select().from(users).where(eq(users.id, userId)))[0];

      const result = await claimQuest(asD1(drz), userId, questId);
      expect(result.bonusXp).toBe(15);
      expect(result.bonusCoins).toBe(5);

      const after = (await drz.select().from(users).where(eq(users.id, userId)))[0];
      expect(after.xpTotal).toBe(before.xpTotal + 15);
      expect(after.coinsBalance).toBe(before.coinsBalance + 5);

      const row = (
        await drz.select().from(dailyQuests).where(eq(dailyQuests.id, questId))
      )[0];
      expect(row.claimed).toBe(true);
      expect(row.claimedAt).not.toBeNull();

      const xp = await drz
        .select()
        .from(xpEvents)
        .where(and(eq(xpEvents.userId, userId), eq(xpEvents.reason, "daily_quest")));
      expect(xp).toHaveLength(1);
      expect(xp[0].delta).toBe(15);

      const coins = await drz
        .select()
        .from(coinEvents)
        .where(and(eq(coinEvents.userId, userId), eq(coinEvents.reason, "daily_quest")));
      expect(coins).toHaveLength(1);
      expect(coins[0].delta).toBe(5);
    });

    it("throws when the quest isn't yet completed", async () => {
      const userId = seedUser(drz);
      const today = todayInTz("UTC");
      const inserted = await drz
        .insert(dailyQuests)
        .values({
          userId,
          date: today,
          kind: "xp" as QuestKind,
          target: 30,
          progress: 10,
        })
        .returning({ id: dailyQuests.id });

      await expect(claimQuest(asD1(drz), userId, inserted[0].id)).rejects.toThrow(
        /not yet completed/i,
      );
    });

    it("throws when the quest is already claimed (no double-award)", async () => {
      const userId = seedUser(drz);
      const today = todayInTz("UTC");
      const inserted = await drz
        .insert(dailyQuests)
        .values({
          userId,
          date: today,
          kind: "xp" as QuestKind,
          target: 30,
          progress: 30,
          completed: true,
          claimed: true,
        })
        .returning({ id: dailyQuests.id });

      await expect(claimQuest(asD1(drz), userId, inserted[0].id)).rejects.toThrow(
        /already claimed/i,
      );
    });

    it("throws when the quest belongs to another user", async () => {
      const owner = seedUser(drz);
      const stranger = seedUser(drz);
      const today = todayInTz("UTC");
      const inserted = await drz
        .insert(dailyQuests)
        .values({
          userId: owner,
          date: today,
          kind: "xp" as QuestKind,
          target: 30,
          progress: 30,
          completed: true,
        })
        .returning({ id: dailyQuests.id });

      await expect(claimQuest(asD1(drz), stranger, inserted[0].id)).rejects.toThrow(
        /not found/i,
      );
    });
  });

  describe("listQuestsForUser", () => {
    it("returns rows sorted by kind with titles populated", async () => {
      const userId = seedUser(drz);
      await seedQuestsForUser(asD1(drz), userId, "UTC", new Date(), seqRand([0.1, 0.5, 0.9, 0.2, 0.7, 0.4]));

      const quests = await listQuestsForUser(asD1(drz), userId, "UTC");
      expect(quests).toHaveLength(3);
      for (const q of quests) {
        expect(q.titleEn.length).toBeGreaterThan(0);
        expect(q.titleNl.length).toBeGreaterThan(0);
        expect(q.target).toBeGreaterThan(0);
      }
      // Sorted ascending by kind.
      const kinds = quests.map((q) => q.kind);
      expect([...kinds].sort()).toEqual(kinds);
    });
  });
});
