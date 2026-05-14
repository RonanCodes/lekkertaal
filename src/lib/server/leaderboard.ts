/**
 * Global leaderboard queries.
 *
 * Three windows:
 * - today:    sum(xp_events.delta) where created_at >= UTC midnight
 * - week:     sum(xp_events.delta) where created_at >= UTC Monday 00:00
 * - all-time: users.xp_total directly
 *
 * v0 uses UTC, not per-user TZ — acceptable for a small launch group; can
 * evolve once we have a real timezone story.
 *
 * Returns { rows, current } where current is the signed-in user's rank +
 * delta, even when they're outside the top 50.
 */
import { createServerFn } from "@tanstack/react-start";
import type { DB } from "../../db/client";
import { db } from "../../db/client";
import { leagues, users, xpEvents } from "../../db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";
import { requireUserClerkId } from "./auth-helper";
import { listFriends } from "./friends";
import { utcMondayOnOrBefore } from "./leagues";

export type LeaderboardWindow = "today" | "week" | "all-time";
export type LeaderboardScope = "global" | "friends";

export type LeaderboardRow = {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  xpTotal: number;
  windowXp: number;
  streakDays: number;
  level: "Bronze" | "Silver" | "Gold" | "Platinum";
  rank: number;
  /** Current-week league tier (1-10) or null when the user has no row yet. */
  leagueTier: number | null;
};

const TOP_N = 50;

/** Per-row payload returned to the friends-leaderboard UI. */
export type FriendsLeaderboardRow = LeaderboardRow & {
  isMe: boolean;
};

export type FriendsLeaderboardResult = {
  window: LeaderboardWindow;
  rows: FriendsLeaderboardRow[];
};

function levelForXp(xp: number): "Bronze" | "Silver" | "Gold" | "Platinum" {
  if (xp >= 10000) return "Platinum";
  if (xp >= 2500) return "Gold";
  if (xp >= 500) return "Silver";
  return "Bronze";
}

/**
 * Batched lookup of the current-week league tier for a set of user ids.
 * Returns a Map keyed by userId. Users without a row this week are absent
 * from the map (callers should default to `null`).
 *
 * One round-trip via `IN (...)` keeps this O(1) DB hops regardless of how
 * many users we render.
 */
async function getCurrentLeagueTiers(
  drz: DB,
  userIds: number[],
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (userIds.length === 0) return out;
  const thisWeek = utcMondayOnOrBefore();
  const rows = await drz
    .select({ userId: leagues.userId, tier: leagues.tier })
    .from(leagues)
    .where(
      sql`${leagues.weekStartDate} = ${thisWeek} AND ${leagues.userId} IN (${sql.join(
        userIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
  for (const r of rows) out.set(r.userId, r.tier);
  return out;
}

function windowStartIso(w: LeaderboardWindow): string | null {
  if (w === "all-time") return null;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  if (w === "week") {
    // Move back to UTC Monday.
    const dow = d.getUTCDay(); // 0 = Sun
    const daysFromMon = (dow + 6) % 7;
    d.setUTCDate(d.getUTCDate() - daysFromMon);
  }
  return d.toISOString();
}

export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((input: { window: LeaderboardWindow }) => input)
  .handler(async ({ data }) => {
    const userId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

    const meRow = me[0];
    const since = windowStartIso(data.window);

    let topRows: LeaderboardRow[] = [];

    if (data.window === "all-time") {
      // Public users only. Order by xp_total desc.
      const rows = await drz
        .select({
          id: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          xpTotal: users.xpTotal,
          streakDays: users.streakDays,
          isPublic: users.isPublic,
        })
        .from(users)
        .where(eq(users.isPublic, true))
        .orderBy(desc(users.xpTotal))
        .limit(TOP_N);
      topRows = rows.map((r, i) => ({
        userId: r.id,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        xpTotal: r.xpTotal,
        windowXp: r.xpTotal,
        streakDays: r.streakDays,
        level: levelForXp(r.xpTotal),
        rank: i + 1,
        leagueTier: null,
      }));
    } else if (since) {
      // Sum xp_events per user since `since`. Join to users for display.
      const rows = await drz
        .select({
          id: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          xpTotal: users.xpTotal,
          streakDays: users.streakDays,
          windowXp: sql<number>`coalesce(sum(${xpEvents.delta}), 0)`.as("window_xp"),
        })
        .from(xpEvents)
        .innerJoin(users, eq(users.id, xpEvents.userId))
        .where(
          sql`${xpEvents.createdAt} >= ${since} AND ${users.isPublic} = 1 AND ${xpEvents.delta} > 0`,
        )
        .groupBy(users.id)
        .orderBy(sql`window_xp desc`)
        .limit(TOP_N);
      topRows = rows.map((r, i) => ({
        userId: r.id,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        xpTotal: r.xpTotal,
        windowXp: Number(r.windowXp),
        streakDays: r.streakDays,
        level: levelForXp(r.xpTotal),
        rank: i + 1,
        leagueTier: null,
      }));
    }

    // Current user — if not in top N, compute their rank + window xp separately.
    let current: LeaderboardRow | null =
      topRows.find((r) => r.userId === meRow.id) ?? null;

    if (!current) {
      let myWindowXp = 0;
      if (data.window === "all-time") {
        myWindowXp = meRow.xpTotal;
      } else if (since) {
        const myEvents = await drz
          .select({ s: sql<number>`coalesce(sum(${xpEvents.delta}), 0)` })
          .from(xpEvents)
          .where(
            sql`${xpEvents.userId} = ${meRow.id} AND ${xpEvents.createdAt} >= ${since} AND ${xpEvents.delta} > 0`,
          );
        myWindowXp = Number(myEvents[0]?.s ?? 0);
      }
      // Approximate rank: count(distinct users with windowXp > mine).
      let ranked = 0;
      if (data.window === "all-time") {
        const cnt = await drz
          .select({ c: sql<number>`count(*)` })
          .from(users)
          .where(sql`${users.isPublic} = 1 AND ${users.xpTotal} > ${myWindowXp}`);
        ranked = Number(cnt[0]?.c ?? 0);
      } else if (since) {
        // Subquery: users whose summed window xp > mine.
        const sub = await drz.all(sql`
          SELECT COUNT(*) as c FROM (
            SELECT user_id, SUM(delta) as s
            FROM xp_events
            WHERE created_at >= ${since} AND delta > 0
            GROUP BY user_id
            HAVING s > ${myWindowXp}
          )
        `);
        const first = (sub as Array<{ c: number }>)[0];
        ranked = Number(first?.c ?? 0);
      }

      current = {
        userId: meRow.id,
        displayName: meRow.displayName,
        avatarUrl: meRow.avatarUrl,
        xpTotal: meRow.xpTotal,
        windowXp: myWindowXp,
        streakDays: meRow.streakDays,
        level: levelForXp(meRow.xpTotal),
        rank: ranked + 1,
        leagueTier: null,
      };
    }

    // Decorate with current-week league tier in a single batched query.
    const ids = topRows.map((r) => r.userId);
    if (current && !ids.includes(current.userId)) ids.push(current.userId);
    const tiers = await getCurrentLeagueTiers(drz, ids);
    topRows = topRows.map((r) => ({ ...r, leagueTier: tiers.get(r.userId) ?? null }));
    if (current) {
      current = { ...current, leagueTier: tiers.get(current.userId) ?? null };
    }

    return {
      user: {
        displayName: meRow.displayName,
        xpTotal: meRow.xpTotal,
        coinsBalance: meRow.coinsBalance,
        streakDays: meRow.streakDays,
        streakFreezesBalance: meRow.streakFreezesBalance,
      },
      window: data.window,
      rows: topRows,
      current,
    };
  });

/**
 * Build the friends-only leaderboard for `userId`. Returns the caller plus
 * every accepted friend, ranked by window XP descending. Pure DB-side
 * function — takes a Drizzle handle so it is exercisable in integration
 * tests against the better-sqlite3 harness.
 *
 * Empty rows[] when the caller has no accepted friendships; the UI uses
 * this to render the "add friends" empty state.
 *
 * The set is small (the caller + friends) so we read each member's window
 * XP individually rather than running a top-N global aggregation. This is
 * O(friends) queries which is fine for the small launch group.
 */
export async function getFriendsLeaderboardForUser(
  drz: DB,
  userId: number,
  windowName: LeaderboardWindow,
): Promise<FriendsLeaderboardResult> {
  const me = await drz.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!me[0]) throw new Error("User row missing");
  const meRow = me[0];

  const friends = await listFriends(drz, userId);
  const since = windowStartIso(windowName);

  // Build the candidate set: caller first, then friends. Each row carries the
  // user's xpTotal + streak; we compute windowXp separately per window.
  type Candidate = {
    userId: number;
    displayName: string;
    avatarUrl: string | null;
    xpTotal: number;
    streakDays: number;
    isMe: boolean;
  };

  const candidates: Candidate[] = [
    {
      userId: meRow.id,
      displayName: meRow.displayName,
      avatarUrl: meRow.avatarUrl,
      xpTotal: meRow.xpTotal,
      streakDays: meRow.streakDays,
      isMe: true,
    },
    ...friends.map((f) => ({
      userId: f.userId,
      displayName: f.displayName,
      avatarUrl: f.avatarUrl,
      xpTotal: f.xpTotal,
      streakDays: f.streakDays,
      isMe: false,
    })),
  ];

  // When no friends, return just the caller so the empty-state UI still has
  // a row to show (the UI decides whether to render rows or the CTA based
  // on friends.length, not rows.length).
  if (friends.length === 0) {
    return { window: windowName, rows: [] };
  }

  // Compute window XP per candidate.
  const withWindowXp: Array<Candidate & { windowXp: number }> = [];
  for (const c of candidates) {
    let windowXp = c.xpTotal;
    if (windowName !== "all-time" && since) {
      const sums = await drz
        .select({ s: sql<number>`coalesce(sum(${xpEvents.delta}), 0)` })
        .from(xpEvents)
        .where(
          sql`${xpEvents.userId} = ${c.userId} AND ${xpEvents.createdAt} >= ${since} AND ${xpEvents.delta} > 0`,
        );
      windowXp = Number(sums[0]?.s ?? 0);
    }
    withWindowXp.push({ ...c, windowXp });
  }

  withWindowXp.sort((a, b) => {
    if (b.windowXp !== a.windowXp) return b.windowXp - a.windowXp;
    return a.displayName.localeCompare(b.displayName);
  });

  const tiers = await getCurrentLeagueTiers(
    drz,
    withWindowXp.map((c) => c.userId),
  );

  const rows: FriendsLeaderboardRow[] = withWindowXp.map((c, i) => ({
    userId: c.userId,
    displayName: c.displayName,
    avatarUrl: c.avatarUrl,
    xpTotal: c.xpTotal,
    windowXp: c.windowXp,
    streakDays: c.streakDays,
    level: levelForXp(c.xpTotal),
    rank: i + 1,
    isMe: c.isMe,
    leagueTier: tiers.get(c.userId) ?? null,
  }));

  return { window: windowName, rows };
}

/**
 * Server-fn wrapper around `getFriendsLeaderboardForUser`. Resolves the
 * signed-in user, defers to the helper, and returns the caller's
 * user-shell (so AppShell can render the top-bar chips without a second
 * round-trip) alongside the rows.
 */
export const getFriendsLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((input: { window: LeaderboardWindow }) => input)
  .handler(async ({ data }) => {
    const clerkId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const meRows = await drz
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (!meRows[0]) throw new Error("User row missing");
    const meRow = meRows[0];

    const result = await getFriendsLeaderboardForUser(drz, meRow.id, data.window);

    return {
      user: {
        displayName: meRow.displayName,
        xpTotal: meRow.xpTotal,
        coinsBalance: meRow.coinsBalance,
        streakDays: meRow.streakDays,
        streakFreezesBalance: meRow.streakFreezesBalance,
      },
      window: result.window,
      rows: result.rows,
    };
  });
