/**
 * League system (P2-ENG-1).
 *
 * Ten-tier weekly ladder. Each user sits in one tier per week. At Monday
 * 00:10 server time the cron:
 *
 *   1. Closes the PREVIOUS week — for every tier, sort that tier's rows by
 *      weeklyXp desc, write finalRank + movement into each row.
 *   2. Opens the NEW week — insert one row per active user with the rolled-
 *      over tier (top 7 promote, bottom 5 demote, middle stay; floor at 1,
 *      cap at 10) and weeklyXp = 0.
 *
 * Feature gate: the cron only runs when `activeUsersThisWeek >= 30`. Below
 * the threshold the global leaderboard alone is enough; running leagues
 * with 5 users would feel pointless.
 *
 * Promotion rules (per tier, per week):
 *   - Top 7 (positions 1..7)        → tier + 1 (cap at TIER_MAX = 10)
 *   - Bottom 5 (last 5 positions)   → tier - 1 (floor at TIER_MIN = 1)
 *   - Everyone else                 → same tier
 *
 * Tiers without enough users to fill all slots collapse gracefully — the
 * helper just slices the sorted list.
 *
 * Active-user definition: any user with at least one positive `xp_events`
 * row in the previous 7 days (UTC). New signups land in tier 1 the first
 * time they earn XP after a Monday roll.
 *
 * `dryRun` mode: returns the planned moves without writing. Used for the
 * first prod run.
 */
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { and, eq, sql } from "drizzle-orm";
import { leagues, xpEvents } from "../../db/schema";

export const TIER_MIN = 1;
export const TIER_MAX = 10;
export const PROMOTE_TOP_N = 7;
export const DEMOTE_BOTTOM_N = 5;
export const ACTIVE_USERS_THRESHOLD = 30;

export type Movement = "up" | "same" | "down";

export type LeagueRollPlan = {
  weekClosing: string; // YYYY-MM-DD of the week we're closing
  weekOpening: string; // YYYY-MM-DD of the new week (next Monday)
  closes: Array<{
    rowId: number;
    userId: number;
    tier: number;
    finalRank: number;
    movement: Movement;
  }>;
  opens: Array<{
    userId: number;
    tier: number;
    weekStartDate: string;
  }>;
};

export type LeagueRollResult =
  | { ran: false; reason: "below_threshold"; activeUsers: number }
  | {
      ran: true;
      activeUsers: number;
      closed: number;
      opened: number;
      dryRun: boolean;
      plan: LeagueRollPlan;
    };

/**
 * Return the YYYY-MM-DD of the most-recent UTC Monday at-or-before `now`.
 *
 * We use UTC across the league system so the cron has a single source of
 * truth and we don't need to wrangle per-user timezones for ranking math.
 */
export function utcMondayOnOrBefore(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay(); // 0 = Sun, 1 = Mon
  const daysFromMon = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMon);
  return d.toISOString().slice(0, 10);
}

/** Add `days` to a YYYY-MM-DD string, returning a new YYYY-MM-DD. */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Pure ranking step: given an array of league rows for one tier, return
 * the closeout payloads (finalRank + movement + nextTier).
 *
 * Sorted DESC by weeklyXp. Ties broken by userId asc for stability.
 */
export function rankTier(
  rows: Array<{ id: number; userId: number; tier: number; weeklyXp: number }>,
): Array<{
  rowId: number;
  userId: number;
  tier: number;
  finalRank: number;
  movement: Movement;
  nextTier: number;
}> {
  const sorted = [...rows].sort((a, b) => {
    if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
    return a.userId - b.userId;
  });
  const n = sorted.length;
  return sorted.map((r, i) => {
    const finalRank = i + 1;
    let movement: Movement = "same";
    let nextTier = r.tier;
    if (finalRank <= PROMOTE_TOP_N) {
      if (r.tier < TIER_MAX) {
        movement = "up";
        nextTier = r.tier + 1;
      } else {
        movement = "same"; // can't promote past Diamond
        nextTier = r.tier;
      }
    } else if (finalRank > n - DEMOTE_BOTTOM_N) {
      if (r.tier > TIER_MIN) {
        movement = "down";
        nextTier = r.tier - 1;
      } else {
        movement = "same"; // floor at Bronze
        nextTier = r.tier;
      }
    }
    return {
      rowId: r.id,
      userId: r.userId,
      tier: r.tier,
      finalRank,
      movement,
      nextTier,
    };
  });
}

/**
 * Count distinct users with at least one positive XP event in the past 7
 * UTC days. Used by the feature gate.
 */
export async function countActiveUsersLastWeek(
  drz: DrizzleD1Database,
  now: Date = new Date(),
): Promise<number> {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 7);
  const sinceIso = since.toISOString();
  const rows = await drz
    .select({ c: sql<number>`count(distinct ${xpEvents.userId})` })
    .from(xpEvents)
    .where(sql`${xpEvents.createdAt} >= ${sinceIso} AND ${xpEvents.delta} > 0`);
  return Number(rows[0]?.c ?? 0);
}

/**
 * Refresh the cached `weekly_xp` on every league row for the closing week.
 *
 * The bump-on-write path (xp grant → also bump leagues.weekly_xp) is
 * tempting but brittle — instead we recompute from xp_events at roll time
 * so the source-of-truth is the events log and a missed update doesn't
 * cause a permanent drift.
 */
export async function refreshWeeklyXp(
  drz: DrizzleD1Database,
  weekStartDate: string,
): Promise<void> {
  const weekEnd = addDays(weekStartDate, 7); // exclusive
  const sums = await drz
    .select({
      userId: xpEvents.userId,
      total: sql<number>`coalesce(sum(${xpEvents.delta}), 0)`,
    })
    .from(xpEvents)
    .where(
      sql`${xpEvents.createdAt} >= ${weekStartDate} AND ${xpEvents.createdAt} < ${weekEnd} AND ${xpEvents.delta} > 0`,
    )
    .groupBy(xpEvents.userId);

  for (const s of sums) {
    await drz
      .update(leagues)
      .set({ weeklyXp: Number(s.total) })
      .where(
        and(eq(leagues.userId, s.userId), eq(leagues.weekStartDate, weekStartDate)),
      );
  }
}

/**
 * Cron entry. Defaults `now` to the current instant. Pass `dryRun` to plan
 * without writing.
 *
 * Steps:
 *   1. Gate: count active users; bail if < ACTIVE_USERS_THRESHOLD.
 *   2. Resolve the week we're CLOSING (last Monday → 7 days ago today, but
 *      from `now` it's the previous Monday).
 *   3. Refresh weekly_xp on all closing rows.
 *   4. Per tier, rank rows and stamp finalRank + movement.
 *   5. Insert NEW week rows for every user that had a row last week, with
 *      the rolled-over tier and weeklyXp = 0.
 *
 * Returns a result describing the plan + counts.
 */
export async function runWeeklyLeagueRoll(
  drz: DrizzleD1Database,
  options: { now?: Date; dryRun?: boolean } = {},
): Promise<LeagueRollResult> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;

  const activeUsers = await countActiveUsersLastWeek(drz, now);
  if (activeUsers < ACTIVE_USERS_THRESHOLD) {
    return { ran: false, reason: "below_threshold", activeUsers };
  }

  // Closing week = the Monday that began 7 days before this Monday.
  const thisMonday = utcMondayOnOrBefore(now);
  const weekClosing = addDays(thisMonday, -7);
  const weekOpening = thisMonday;

  if (!dryRun) {
    await refreshWeeklyXp(drz, weekClosing);
  }

  // Read all closing rows. If empty (first week with leagues), seed every
  // active user into tier 1 for the new week and exit.
  const closingRows = await drz
    .select({
      id: leagues.id,
      userId: leagues.userId,
      tier: leagues.tier,
      weeklyXp: leagues.weeklyXp,
    })
    .from(leagues)
    .where(eq(leagues.weekStartDate, weekClosing));

  // Group by tier in memory. Tier counts are tiny (10 buckets).
  const byTier = new Map<number, typeof closingRows>();
  for (const r of closingRows) {
    const arr = byTier.get(r.tier) ?? [];
    arr.push(r);
    byTier.set(r.tier, arr);
  }

  const closes: LeagueRollPlan["closes"] = [];
  const opensMap = new Map<number, number>(); // userId → nextTier

  for (const [, rows] of byTier) {
    const ranked = rankTier(rows);
    for (const r of ranked) {
      closes.push({
        rowId: r.rowId,
        userId: r.userId,
        tier: r.tier,
        finalRank: r.finalRank,
        movement: r.movement,
      });
      opensMap.set(r.userId, r.nextTier);
    }
  }

  // Bootstrap: any user with positive XP this past week who DIDN'T have a
  // closing-week row gets seeded fresh into tier 1.
  const sinceIso = `${weekClosing}T00:00:00.000Z`;
  const untilIso = `${weekOpening}T00:00:00.000Z`;
  const fresh = await drz
    .select({ userId: xpEvents.userId })
    .from(xpEvents)
    .where(
      sql`${xpEvents.createdAt} >= ${sinceIso} AND ${xpEvents.createdAt} < ${untilIso} AND ${xpEvents.delta} > 0`,
    )
    .groupBy(xpEvents.userId);
  for (const f of fresh) {
    if (!opensMap.has(f.userId)) {
      opensMap.set(f.userId, TIER_MIN);
    }
  }

  const opens: LeagueRollPlan["opens"] = Array.from(opensMap.entries()).map(
    ([userId, tier]) => ({
      userId,
      tier,
      weekStartDate: weekOpening,
    }),
  );

  if (!dryRun) {
    // Stamp closeouts.
    for (const c of closes) {
      await drz
        .update(leagues)
        .set({ finalRank: c.finalRank, movement: c.movement })
        .where(eq(leagues.id, c.rowId));
    }
    // Open new-week rows. Idempotent via the unique (userId, weekStartDate)
    // index — a re-run on the same Monday is a no-op.
    for (const o of opens) {
      try {
        await drz
          .insert(leagues)
          .values({
            userId: o.userId,
            tier: o.tier,
            weekStartDate: o.weekStartDate,
            weeklyXp: 0,
          });
      } catch {
        // Unique-conflict — already opened, safe to ignore.
      }
    }
  }

  return {
    ran: true,
    activeUsers,
    closed: closes.length,
    opened: opens.length,
    dryRun,
    plan: { weekClosing, weekOpening, closes, opens },
  };
}

/**
 * Look up the current tier for a user. Returns null when the user has no
 * league row yet (leagues haven't crossed the threshold, or this is the
 * user's first week before the next Monday roll).
 */
export async function getCurrentLeagueForUser(
  drz: DrizzleD1Database,
  userId: number,
  now: Date = new Date(),
): Promise<{ tier: number; weeklyXp: number; weekStartDate: string } | null> {
  const thisWeek = utcMondayOnOrBefore(now);
  const rows = await drz
    .select({
      tier: leagues.tier,
      weeklyXp: leagues.weeklyXp,
      weekStartDate: leagues.weekStartDate,
    })
    .from(leagues)
    .where(and(eq(leagues.userId, userId), eq(leagues.weekStartDate, thisWeek)))
    .limit(1);
  if (!rows[0]) return null;
  return rows[0];
}

/**
 * Tier metadata for the UI badge. Names match the common Duolingo-style
 * ladder so users have a familiar mental model.
 */
export const TIER_NAMES: Record<number, { name: string; emoji: string }> = {
  1: { name: "Bronze", emoji: "🥉" },
  2: { name: "Silver", emoji: "🥈" },
  3: { name: "Gold", emoji: "🥇" },
  4: { name: "Sapphire", emoji: "💙" },
  5: { name: "Ruby", emoji: "❤️" },
  6: { name: "Emerald", emoji: "💚" },
  7: { name: "Amethyst", emoji: "💜" },
  8: { name: "Pearl", emoji: "🤍" },
  9: { name: "Obsidian", emoji: "🖤" },
  10: { name: "Diamond", emoji: "💎" },
};

export function tierMeta(tier: number): { name: string; emoji: string } {
  return TIER_NAMES[tier] ?? { name: `Tier ${tier}`, emoji: "🏅" };
}
