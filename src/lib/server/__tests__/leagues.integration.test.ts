/**
 * Integration tests for the league system (P2-ENG-1).
 *
 * Drives `runWeeklyLeagueRoll` against the in-memory better-sqlite3 D1
 * harness. Covers promotion, demotion, the tier-1 floor, the rollover-with-
 * no-XP path, and the < 30 active-users feature gate.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { leagues } from "../../../db/schema";
import {
  ACTIVE_USERS_THRESHOLD,
  addDays,
  countActiveUsersLastWeek,
  getCurrentLeagueForUser,
  rankTier,
  runWeeklyLeagueRoll,
  utcMondayOnOrBefore,
} from "../leagues";
import { asD1, makeTestDb, seedUser } from "./test-db";
import type { TestDb } from "./test-db";

/**
 * Helper — insert a closing-week league row directly so we don't need to
 * grant XP first. Production also seeds rows from xp_events on bootstrap;
 * the helper just shortcuts the setup.
 */
function insertLeagueRow(
  drz: TestDb,
  userId: number,
  tier: number,
  weekStartDate: string,
  weeklyXp = 0,
): number {
  const r = drz.$sqlite
    .prepare(
      `INSERT INTO leagues (user_id, tier, week_start_date, weekly_xp)
       VALUES (?, ?, ?, ?)`,
    )
    .run(userId, tier, weekStartDate, weeklyXp);
  return Number(r.lastInsertRowid);
}

/** Helper — grant XP to N distinct users over the past 7 days. Used to
 *  cross the activity gate. */
function grantWeeklyXp(drz: TestDb, userIds: number[], delta = 10): void {
  for (const uid of userIds) {
    drz.$sqlite
      .prepare(
        `INSERT INTO xp_events (user_id, delta, reason, created_at)
         VALUES (?, ?, 'test', datetime('now', '-1 day'))`,
      )
      .run(uid, delta);
  }
}

describe("league system (integration: in-memory D1)", () => {
  let drz: TestDb;
  // Fix "now" to a Tuesday so the previous Monday is unambiguous.
  // 2026-05-12 is a Tuesday → previous Monday is 2026-05-11.
  const NOW = new Date("2026-05-12T00:15:00.000Z");

  beforeEach(() => {
    drz = makeTestDb();
  });

  describe("utcMondayOnOrBefore", () => {
    it("returns the same date when called on a Monday", () => {
      const mon = new Date("2026-05-11T00:30:00.000Z");
      expect(utcMondayOnOrBefore(mon)).toBe("2026-05-11");
    });
    it("rolls back to the previous Monday on midweek days", () => {
      const wed = new Date("2026-05-13T15:00:00.000Z");
      expect(utcMondayOnOrBefore(wed)).toBe("2026-05-11");
    });
    it("rolls back from Sunday to the previous Monday", () => {
      const sun = new Date("2026-05-10T23:59:00.000Z");
      expect(utcMondayOnOrBefore(sun)).toBe("2026-05-04");
    });
  });

  describe("addDays", () => {
    it("adds days across month boundaries", () => {
      expect(addDays("2026-05-30", 5)).toBe("2026-06-04");
    });
    it("subtracts days when given a negative offset", () => {
      expect(addDays("2026-05-11", -7)).toBe("2026-05-04");
    });
  });

  describe("rankTier (pure)", () => {
    it("promotes top 7 and demotes bottom 5 in a 15-user tier", () => {
      const rows = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        userId: 100 + i,
        tier: 3,
        weeklyXp: 1000 - i * 10, // user 100 has 1000 XP (best), user 114 has 860 (worst)
      }));
      const ranked = rankTier(rows);
      // Top 7 → up
      expect(ranked.slice(0, 7).every((r) => r.movement === "up")).toBe(true);
      expect(ranked.slice(0, 7).every((r) => r.nextTier === 4)).toBe(true);
      // Bottom 5 → down (positions 11..15)
      expect(ranked.slice(-5).every((r) => r.movement === "down")).toBe(true);
      expect(ranked.slice(-5).every((r) => r.nextTier === 2)).toBe(true);
      // Middle 3 → same
      const middle = ranked.slice(7, 10);
      expect(middle.every((r) => r.movement === "same")).toBe(true);
      expect(middle.every((r) => r.nextTier === 3)).toBe(true);
    });

    it("does NOT demote below tier 1", () => {
      // 15 users in tier 1 — positions 11..15 fall in the bottom-5 demote
      // band; with tier=1 they should pin at 1 with movement "same".
      const rows = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        userId: 200 + i,
        tier: 1,
        weeklyXp: 1500 - i * 100,
      }));
      const ranked = rankTier(rows);
      const bottom = ranked.slice(-5);
      expect(bottom.every((r) => r.nextTier === 1)).toBe(true);
      expect(bottom.every((r) => r.movement === "same")).toBe(true);
      // And the top 7 still promote to tier 2 (no cap issue at the bottom).
      const top = ranked.slice(0, 7);
      expect(top.every((r) => r.nextTier === 2)).toBe(true);
      expect(top.every((r) => r.movement === "up")).toBe(true);
    });

    it("does NOT promote above tier 10", () => {
      // 15 users in tier 10. Top 7 would normally promote; here pin at 10.
      const rows = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        userId: 300 + i,
        tier: 10,
        weeklyXp: 1500 - i * 100,
      }));
      const ranked = rankTier(rows);
      const top = ranked.slice(0, 7);
      expect(top.every((r) => r.nextTier === 10)).toBe(true);
      expect(top.every((r) => r.movement === "same")).toBe(true);
      // Bottom 5 still demote to tier 9 (no cap issue at the top).
      const bottom = ranked.slice(-5);
      expect(bottom.every((r) => r.nextTier === 9)).toBe(true);
      expect(bottom.every((r) => r.movement === "down")).toBe(true);
    });
  });

  describe("feature gate", () => {
    it("returns ran=false when active-user count is below the threshold", async () => {
      // Seed only 5 users, all with XP in the past week.
      const ids = Array.from({ length: 5 }, () => seedUser(drz));
      grantWeeklyXp(drz, ids);

      const r = await runWeeklyLeagueRoll(asD1(drz), { now: NOW });
      expect(r.ran).toBe(false);
      if (!r.ran) {
        expect(r.reason).toBe("below_threshold");
        expect(r.activeUsers).toBe(5);
      }
    });

    it("countActiveUsersLastWeek reflects the population correctly", async () => {
      const ids = Array.from({ length: 7 }, () => seedUser(drz));
      grantWeeklyXp(drz, ids.slice(0, 4)); // only 4 active

      const n = await countActiveUsersLastWeek(asD1(drz), NOW);
      expect(n).toBe(4);
    });
  });

  describe("runWeeklyLeagueRoll above threshold", () => {
    /**
     * Set up a synthetic population at the threshold so the roll runs.
     * 30 users in tier 3 with descending XP, plus 30 users in tier 1 also
     * descending. We grant XP rows so the feature gate passes.
     */
    function seedThirtyActive(weekClosing: string): {
      tier3Ids: number[];
      tier1Ids: number[];
    } {
      // Tier 3 cohort: 15 users
      const tier3Ids: number[] = [];
      for (let i = 0; i < 15; i++) {
        const uid = seedUser(drz);
        insertLeagueRow(drz, uid, 3, weekClosing, 1000 - i * 10);
        tier3Ids.push(uid);
      }
      // Tier 1 cohort: 15 users
      const tier1Ids: number[] = [];
      for (let i = 0; i < 15; i++) {
        const uid = seedUser(drz);
        insertLeagueRow(drz, uid, 1, weekClosing, 800 - i * 10);
        tier1Ids.push(uid);
      }
      // Grant XP so countActiveUsersLastWeek hits 30.
      grantWeeklyXp(drz, [...tier3Ids, ...tier1Ids]);
      return { tier3Ids, tier1Ids };
    }

    it("promotes top 7 of tier 3 to tier 4 in the new week", async () => {
      const thisMon = utcMondayOnOrBefore(NOW);
      const weekClosing = addDays(thisMon, -7);
      const { tier3Ids } = seedThirtyActive(weekClosing);

      const r = await runWeeklyLeagueRoll(asD1(drz), { now: NOW });
      expect(r.ran).toBe(true);
      if (!r.ran) return;

      // Look up new-week row for the top-ranked tier-3 user.
      const winner = tier3Ids[0]; // had 1000 XP — best in tier 3
      const newRow = await drz
        .select()
        .from(leagues)
        .where(and(eq(leagues.userId, winner), eq(leagues.weekStartDate, thisMon)))
        .limit(1);
      expect(newRow[0]?.tier).toBe(4);

      // And the old row got a finalRank=1 + movement=up.
      const oldRow = await drz
        .select()
        .from(leagues)
        .where(and(eq(leagues.userId, winner), eq(leagues.weekStartDate, weekClosing)))
        .limit(1);
      expect(oldRow[0]?.finalRank).toBe(1);
      expect(oldRow[0]?.movement).toBe("up");
    });

    it("demotes bottom 5 of tier 3 to tier 2", async () => {
      const thisMon = utcMondayOnOrBefore(NOW);
      const weekClosing = addDays(thisMon, -7);
      const { tier3Ids } = seedThirtyActive(weekClosing);

      const r = await runWeeklyLeagueRoll(asD1(drz), { now: NOW });
      expect(r.ran).toBe(true);

      const loser = tier3Ids[14]; // worst tier-3 user (XP 860)
      const newRow = await drz
        .select()
        .from(leagues)
        .where(and(eq(leagues.userId, loser), eq(leagues.weekStartDate, thisMon)))
        .limit(1);
      expect(newRow[0]?.tier).toBe(2);

      const oldRow = await drz
        .select()
        .from(leagues)
        .where(and(eq(leagues.userId, loser), eq(leagues.weekStartDate, weekClosing)))
        .limit(1);
      expect(oldRow[0]?.movement).toBe("down");
    });

    it("does NOT demote tier-1 users below tier 1", async () => {
      const thisMon = utcMondayOnOrBefore(NOW);
      const weekClosing = addDays(thisMon, -7);
      const { tier1Ids } = seedThirtyActive(weekClosing);

      const r = await runWeeklyLeagueRoll(asD1(drz), { now: NOW });
      expect(r.ran).toBe(true);

      const loser = tier1Ids[14]; // worst tier-1 user
      const newRow = await drz
        .select()
        .from(leagues)
        .where(and(eq(leagues.userId, loser), eq(leagues.weekStartDate, thisMon)))
        .limit(1);
      expect(newRow[0]?.tier).toBe(1);
    });

    it("rolls users with zero weekly XP into a new-week row", async () => {
      const thisMon = utcMondayOnOrBefore(NOW);
      const weekClosing = addDays(thisMon, -7);
      // Seed exactly THRESHOLD users so the gate is satisfied, but give
      // them weeklyXp=0 in the closing row. We still grant a stub XP event
      // so countActiveUsersLastWeek picks them up.
      const ids: number[] = [];
      for (let i = 0; i < ACTIVE_USERS_THRESHOLD; i++) {
        const uid = seedUser(drz);
        insertLeagueRow(drz, uid, 5, weekClosing, 0); // mid-tier, no XP
        ids.push(uid);
      }
      grantWeeklyXp(drz, ids);

      const r = await runWeeklyLeagueRoll(asD1(drz), { now: NOW });
      expect(r.ran).toBe(true);
      if (!r.ran) return;
      expect(r.opened).toBe(ACTIVE_USERS_THRESHOLD);

      // Every user has a new-week row.
      for (const uid of ids) {
        const row = await drz
          .select()
          .from(leagues)
          .where(and(eq(leagues.userId, uid), eq(leagues.weekStartDate, thisMon)))
          .limit(1);
        expect(row[0]).toBeDefined();
        expect(row[0]?.weeklyXp).toBe(0);
      }
    });

    it("dry-run plans the moves but writes nothing", async () => {
      const thisMon = utcMondayOnOrBefore(NOW);
      const weekClosing = addDays(thisMon, -7);
      seedThirtyActive(weekClosing);

      const r = await runWeeklyLeagueRoll(asD1(drz), { now: NOW, dryRun: true });
      expect(r.ran).toBe(true);
      if (!r.ran) return;
      expect(r.dryRun).toBe(true);
      expect(r.plan.closes.length).toBeGreaterThan(0);
      expect(r.plan.opens.length).toBeGreaterThan(0);

      // No new-week rows were written.
      const newWeekRows = await drz
        .select()
        .from(leagues)
        .where(eq(leagues.weekStartDate, thisMon));
      expect(newWeekRows.length).toBe(0);

      // No closeout stamps either — finalRank should still be null on closing rows.
      const closingRows = await drz
        .select()
        .from(leagues)
        .where(eq(leagues.weekStartDate, weekClosing));
      expect(closingRows.every((r) => r.finalRank === null)).toBe(true);
    });

    it("is idempotent — a second run on the same Monday is a no-op", async () => {
      const thisMon = utcMondayOnOrBefore(NOW);
      const weekClosing = addDays(thisMon, -7);
      seedThirtyActive(weekClosing);

      const first = await runWeeklyLeagueRoll(asD1(drz), { now: NOW });
      expect(first.ran).toBe(true);

      const newRowsAfterFirst = await drz
        .select()
        .from(leagues)
        .where(eq(leagues.weekStartDate, thisMon));

      const second = await runWeeklyLeagueRoll(asD1(drz), { now: NOW });
      expect(second.ran).toBe(true);

      const newRowsAfterSecond = await drz
        .select()
        .from(leagues)
        .where(eq(leagues.weekStartDate, thisMon));
      expect(newRowsAfterSecond.length).toBe(newRowsAfterFirst.length);
    });
  });

  describe("getCurrentLeagueForUser", () => {
    it("returns null when the user has no row this week", async () => {
      const uid = seedUser(drz);
      const r = await getCurrentLeagueForUser(asD1(drz), uid, NOW);
      expect(r).toBeNull();
    });
    it("returns the current-week row when present", async () => {
      const uid = seedUser(drz);
      const thisMon = utcMondayOnOrBefore(NOW);
      insertLeagueRow(drz, uid, 4, thisMon, 123);
      const r = await getCurrentLeagueForUser(asD1(drz), uid, NOW);
      expect(r).toEqual({ tier: 4, weeklyXp: 123, weekStartDate: thisMon });
    });
  });
});
