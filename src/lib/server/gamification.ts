/**
 * XP / coins / streak engine.
 *
 * Pure helpers — designed to be called from inside other server functions
 * (completeLesson, gradeRoleplaySession). They do their own DB writes but
 * never read auth(), so the caller is responsible for resolving the user.
 *
 * Awards:
 * - lesson complete: +20 XP +5 coins
 * - boss-fight (roleplay) complete: scales with stars (1-5) over the
 *   scenario's xp_reward (gradeRoleplaySession owns the XP scaling); we
 *   only handle coins (+25 on a passing star count) and the daily/streak
 *   side-effect here.
 *
 * Streak rules:
 * - First completion of a UTC day = streakDays += 1 if yesterday was active,
 *   else streakDays = 1 (fresh start).
 * - If the gap is > 1 day AND user has streak_freezes_balance > 0, consume
 *   one freeze and KEEP the streak (the freeze covers exactly one missed
 *   day; longer gaps still reset).
 *
 * The cron-based midnight reset (acceptance #6) lives in entry.server.ts
 * scheduled() and is wired by the existing 0 * * * * cron.
 */
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  users,
  xpEvents,
  coinEvents,
  dailyCompletions,
} from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { bumpQuestProgress } from "./daily-quests";

export const LESSON_XP_REWARD = 20;
export const LESSON_COIN_REWARD = 5;
export const ROLEPLAY_PASSING_COIN_REWARD = 25;

// US-022: milestone-day → freeze grants.
// Keys are the streak-day threshold; values are the number of freezes to grant
// the *first* time the user crosses that milestone (de-duplicated by checking
// the previous streakDays value against the threshold).
export const STREAK_MILESTONE_FREEZES: Array<{ day: number; grant: number }> = [
  { day: 7, grant: 1 },
  { day: 14, grant: 1 },
  { day: 30, grant: 2 },
  { day: 60, grant: 3 },
  { day: 100, grant: 5 },
];

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Bump streak based on today vs streak_last_active_date.
 *
 * Returns { streakDays, freezeUsed } so callers can show fanfare or
 * notify users that their freeze was consumed.
 */
export async function bumpStreakIfFirstToday(
  drz: DrizzleD1Database,
  userId: number,
): Promise<{
  streakDays: number;
  freezeUsed: boolean;
  alreadyActiveToday: boolean;
  milestoneFreezesAwarded: number;
}> {
  const me = await drz.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!me[0]) throw new Error("User row missing for streak bump");
  const today = todayUtc();
  const yesterday = yesterdayUtc();
  const last = me[0].streakLastActiveDate;

  if (last === today) {
    return {
      streakDays: me[0].streakDays,
      freezeUsed: false,
      alreadyActiveToday: true,
      milestoneFreezesAwarded: 0,
    };
  }

  const previousStreakDays = me[0].streakDays;
  let newStreakDays = 1;
  let freezeUsed = false;
  let newFreezeBalance = me[0].streakFreezesBalance;

  if (last === yesterday) {
    newStreakDays = previousStreakDays + 1;
  } else if (last && last < yesterday && me[0].streakFreezesBalance > 0) {
    // The user missed a day but has a freeze available — consume one.
    newStreakDays = previousStreakDays + 1;
    freezeUsed = true;
    newFreezeBalance = me[0].streakFreezesBalance - 1;
  } else {
    newStreakDays = 1; // fresh start
  }

  // US-022: milestone freeze grants. Only fire when this bump crosses the
  // threshold for the first time (previous < day && new >= day). Multiple
  // milestones in one bump (e.g. fresh-start past 7d) are not possible since
  // newStreakDays only ever increases by 1.
  let milestoneFreezesAwarded = 0;
  for (const m of STREAK_MILESTONE_FREEZES) {
    if (previousStreakDays < m.day && newStreakDays >= m.day) {
      milestoneFreezesAwarded += m.grant;
    }
  }
  newFreezeBalance += milestoneFreezesAwarded;

  await drz
    .update(users)
    .set({
      streakDays: newStreakDays,
      streakLastActiveDate: today,
      streakFreezesBalance: newFreezeBalance,
    })
    .where(eq(users.id, userId));

  return {
    streakDays: newStreakDays,
    freezeUsed,
    alreadyActiveToday: false,
    milestoneFreezesAwarded,
  };
}

/** Upsert today's daily_completions row, accumulating xp/lessons/drills. */
export async function upsertDailyCompletion(
  drz: DrizzleD1Database,
  userId: number,
  delta: { xp?: number; lessons?: number; drills?: number; freezeUsed?: boolean },
): Promise<void> {
  const today = todayUtc();
  const existing = await drz
    .select()
    .from(dailyCompletions)
    .where(and(eq(dailyCompletions.userId, userId), eq(dailyCompletions.date, today)))
    .limit(1);

  if (existing[0]) {
    await drz
      .update(dailyCompletions)
      .set({
        xpEarned: existing[0].xpEarned + (delta.xp ?? 0),
        lessonsCompleted: existing[0].lessonsCompleted + (delta.lessons ?? 0),
        drillsCompleted: existing[0].drillsCompleted + (delta.drills ?? 0),
        freezeUsed: existing[0].freezeUsed || (delta.freezeUsed ?? false),
      })
      .where(eq(dailyCompletions.id, existing[0].id));
  } else {
    await drz.insert(dailyCompletions).values({
      userId,
      date: today,
      xpEarned: delta.xp ?? 0,
      lessonsCompleted: delta.lessons ?? 0,
      drillsCompleted: delta.drills ?? 0,
      freezeUsed: delta.freezeUsed ?? false,
    });
  }
}

/**
 * Award lesson-complete (XP + coins + daily + streak).
 *
 * Pass alreadyDone=true on a re-completion to skip the awards but still
 * touch the streak (because the user did some practice today).
 */
export async function awardLessonComplete(
  drz: DrizzleD1Database,
  userId: number,
  lessonId: number,
  alreadyDone: boolean,
): Promise<{ xpAwarded: number; coinsAwarded: number; streakDays: number; freezeUsed: boolean }> {
  let xpAwarded = 0;
  let coinsAwarded = 0;

  if (!alreadyDone) {
    xpAwarded = LESSON_XP_REWARD;
    coinsAwarded = LESSON_COIN_REWARD;
    await drz
      .update(users)
      .set({
        xpTotal: sql`${users.xpTotal} + ${xpAwarded}`,
        coinsBalance: sql`${users.coinsBalance} + ${coinsAwarded}`,
      })
      .where(eq(users.id, userId));
    await drz.insert(xpEvents).values({
      userId,
      delta: xpAwarded,
      reason: "lesson_complete",
      refType: "lesson",
      refId: String(lessonId),
    });
    await drz.insert(coinEvents).values({
      userId,
      delta: coinsAwarded,
      reason: "lesson_complete",
      refType: "lesson",
      refId: String(lessonId),
    });
  }

  const streak = await bumpStreakIfFirstToday(drz, userId);
  await upsertDailyCompletion(drz, userId, {
    xp: xpAwarded,
    lessons: alreadyDone ? 0 : 1,
    freezeUsed: streak.freezeUsed,
  });

  // P2-CON-3: feed daily-quest progress. XP and lesson grants count toward
  // their respective quest kinds; the streak bump feeds the `streak` quest
  // exactly once per day (the helper returns alreadyActiveToday on re-calls).
  if (xpAwarded > 0) {
    await bumpQuestProgress(drz, userId, "xp", xpAwarded);
  }
  if (!alreadyDone) {
    await bumpQuestProgress(drz, userId, "lessons", 1);
  }
  if (!streak.alreadyActiveToday) {
    await bumpQuestProgress(drz, userId, "streak", 1);
  }

  return {
    xpAwarded,
    coinsAwarded,
    streakDays: streak.streakDays,
    freezeUsed: streak.freezeUsed,
  };
}

/**
 * Award roleplay-complete coins + streak. XP for roleplay is awarded by
 * gradeRoleplaySession (which knows the star count). This helper just adds
 * the flat-rate coin grant on a passing attempt and updates daily/streak.
 */
export async function awardRoleplayComplete(
  drz: DrizzleD1Database,
  userId: number,
  sessionId: number,
  passed: boolean,
  newlyAwarded: boolean,
  xpJustAwarded: number,
): Promise<{ coinsAwarded: number; streakDays: number; freezeUsed: boolean }> {
  let coinsAwarded = 0;

  if (passed && newlyAwarded) {
    coinsAwarded = ROLEPLAY_PASSING_COIN_REWARD;
    await drz
      .update(users)
      .set({ coinsBalance: sql`${users.coinsBalance} + ${coinsAwarded}` })
      .where(eq(users.id, userId));
    await drz.insert(coinEvents).values({
      userId,
      delta: coinsAwarded,
      reason: "roleplay_pass",
      refType: "roleplay_session",
      refId: String(sessionId),
    });
  }

  if (newlyAwarded && xpJustAwarded > 0) {
    await drz.insert(xpEvents).values({
      userId,
      delta: xpJustAwarded,
      reason: "roleplay",
      refType: "roleplay_session",
      refId: String(sessionId),
    });
  }

  const streak = await bumpStreakIfFirstToday(drz, userId);
  await upsertDailyCompletion(drz, userId, {
    xp: newlyAwarded ? xpJustAwarded : 0,
    lessons: 0,
    freezeUsed: streak.freezeUsed,
  });

  // P2-CON-3: feed daily-quest progress for roleplay XP grants + streak bump.
  // The `speak` kind is wired by P2-STT-3 (#56) when the speak-drill submit
  // path lands; until then, roleplay XP only feeds the `xp` quest.
  // TODO(#56): bump `speak` quest from the speak-drill submit handler.
  if (newlyAwarded && xpJustAwarded > 0) {
    await bumpQuestProgress(drz, userId, "xp", xpJustAwarded);
  }
  if (!streak.alreadyActiveToday) {
    await bumpQuestProgress(drz, userId, "streak", 1);
  }

  return {
    coinsAwarded,
    streakDays: streak.streakDays,
    freezeUsed: streak.freezeUsed,
  };
}

/**
 * Cron-side helper: scan users whose streakLastActiveDate is older than
 * yesterday and reset to 0 (after consuming a freeze if one is available).
 *
 * Called from entry.server.ts scheduled(). The 0 * * * * cron runs every
 * hour so this can be cheap; we only mutate users who actually need it.
 */
export async function resetStaleStreaks(drz: DrizzleD1Database): Promise<number> {
  const yesterday = yesterdayUtc();
  // Find candidates: anyone with streakDays > 0 whose last active is NOT
  // today and NOT yesterday (so they missed at least one full day).
  const stale = await drz
    .select()
    .from(users)
    .where(
      and(
        sql`${users.streakDays} > 0`,
        sql`(${users.streakLastActiveDate} IS NULL OR ${users.streakLastActiveDate} < ${yesterday})`,
      ),
    );

  let resetCount = 0;
  for (const u of stale) {
    if (u.streakFreezesBalance > 0) {
      // Consume one freeze and bump the last-active to yesterday so they have
      // until end-of-today to act. Streak preserved.
      await drz
        .update(users)
        .set({
          streakFreezesBalance: u.streakFreezesBalance - 1,
          streakLastActiveDate: yesterday,
        })
        .where(eq(users.id, u.id));
    } else {
      await drz
        .update(users)
        .set({ streakDays: 0 })
        .where(eq(users.id, u.id));
      resetCount++;
    }
  }
  return resetCount;
}
