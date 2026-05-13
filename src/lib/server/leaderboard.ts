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
import { redirect } from "@tanstack/react-router";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/client";
import { users, xpEvents } from "../../db/schema";
import { desc, eq, gte, sql } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";

export type LeaderboardWindow = "today" | "week" | "all-time";

export type LeaderboardRow = {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  xpTotal: number;
  windowXp: number;
  streakDays: number;
  level: "Bronze" | "Silver" | "Gold" | "Platinum";
  rank: number;
};

const TOP_N = 50;

function levelForXp(xp: number): "Bronze" | "Silver" | "Gold" | "Platinum" {
  if (xp >= 10000) return "Platinum";
  if (xp >= 2500) return "Gold";
  if (xp >= 500) return "Silver";
  return "Bronze";
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
    const a = await auth();
    if (!a.userId) throw redirect({ to: "/sign-in" });
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
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
      };
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
