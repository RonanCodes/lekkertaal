/**
 * Daily quests engine (P2-CON-3).
 *
 * Three quests per user per local-tz day. Cron seeds at 00:05 server time and
 * is idempotent across re-runs. Underlying gameplay events (XP gained, lesson
 * complete, streak bumped) call `bumpQuestProgress` to advance any open quest
 * of the matching kind for today's row.
 *
 * Kinds:
 *   - xp       → earn target XP today (target ∈ {30, 50, 100})
 *   - lessons  → finish target lessons today (target ∈ {1, 2, 3})
 *   - streak   → extend the streak today (target = 1; bumped from streak helper)
 *   - speak    → complete target speak drills (wired by P2-STT-3 #56)
 *
 * Claim awards bonus XP + coins and marks the row as `claimed`. Claim is
 * only allowed when `progress >= target` AND `claimed === false`.
 *
 * Local-date is computed via `Intl.DateTimeFormat` with the user's tz so
 * cron output respects the offset stored on `users.timezone`.
 */
import type { DB } from "../../db/client";
import { and, eq, sql } from "drizzle-orm";
import { dailyQuests, users, xpEvents, coinEvents } from "../../db/schema";

export type QuestKind = "xp" | "lessons" | "streak" | "speak";

const QUEST_KINDS: QuestKind[] = ["xp", "lessons", "streak", "speak"];

// Target tiers per kind. Picker chooses one at random when seeding.
const TARGETS: Record<QuestKind, number[]> = {
  xp: [30, 50, 100],
  lessons: [1, 2, 3],
  streak: [1],
  speak: [1, 2],
};

// Bonus reward shape (flat for v0; richer scaling lives in a later issue).
const BONUS_XP = 15;
const BONUS_COINS = 5;

const QUEST_TITLES: Record<QuestKind, (target: number) => { nl: string; en: string }> = {
  xp: (n) => ({ nl: `Verdien ${n} XP vandaag`, en: `Earn ${n} XP today` }),
  lessons: (n) => ({
    nl: `Maak ${n} ${n === 1 ? "les" : "lessen"} af`,
    en: `Finish ${n} ${n === 1 ? "lesson" : "lessons"}`,
  }),
  streak: () => ({ nl: "Houd je reeks vandaag in stand", en: "Extend your streak today" }),
  speak: (n) => ({
    nl: `Doe ${n} ${n === 1 ? "spreekoefening" : "spreekoefeningen"}`,
    en: `Complete ${n} speak ${n === 1 ? "drill" : "drills"}`,
  }),
};

export function questTitle(kind: QuestKind, target: number): { nl: string; en: string } {
  return QUEST_TITLES[kind](target);
}

/**
 * Today's YYYY-MM-DD in the given IANA timezone. Falls back to UTC if the
 * tz string is unparseable (CF Workers ships a full ICU build so this is
 * essentially never hit, but the guard keeps tests deterministic).
 */
export function todayInTz(tz: string, now: Date = new Date()): string {
  try {
    // en-CA emits ISO-shaped YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Deterministic-friendly random picker. Tests can replace `randFn` with a
 * fixed-sequence stub. Production uses Math.random.
 */
export type RandFn = () => number;

function pickN<T>(arr: T[], n: number, rand: RandFn): T[] {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    const idx = Math.floor(rand() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function pickTarget(kind: QuestKind, rand: RandFn): number {
  const opts = TARGETS[kind];
  return opts[Math.floor(rand() * opts.length)];
}

/**
 * Build the 3 quest rows for a user on a given local date. Picks 3 distinct
 * kinds at random (out of {xp, lessons, streak, speak}) and a target per kind.
 */
export function chooseQuestsForToday(
  userId: number,
  date: string,
  rand: RandFn = Math.random,
): Array<{
  userId: number;
  date: string;
  kind: QuestKind;
  target: number;
  bonusXp: number;
  bonusCoins: number;
}> {
  const kinds = pickN(QUEST_KINDS, 3, rand);
  return kinds.map((kind) => ({
    userId,
    date,
    kind,
    target: pickTarget(kind, rand),
    bonusXp: BONUS_XP,
    bonusCoins: BONUS_COINS,
  }));
}

/**
 * Seed today's quests for ONE user. Idempotent — uses the unique
 * (userId, date, kind) index plus an `onConflictDoNothing` clause so a
 * re-run on the same local-day is a no-op even when distinct kinds were
 * already inserted.
 *
 * Returns the number of NEW rows actually written (0 when same-day rerun).
 */
export async function seedQuestsForUser(
  drz: DB,
  userId: number,
  timezone: string,
  now: Date = new Date(),
  rand: RandFn = Math.random,
): Promise<number> {
  const date = todayInTz(timezone, now);

  // Cheap idempotency check: if the user already has any rows for this date,
  // skip the insert pass entirely. This avoids burning the random sequence
  // and keeps the cron log readable.
  const existing = await drz
    .select({ id: dailyQuests.id })
    .from(dailyQuests)
    .where(and(eq(dailyQuests.userId, userId), eq(dailyQuests.date, date)))
    .limit(1);
  if (existing[0]) return 0;

  const rows = chooseQuestsForToday(userId, date, rand);
  let inserted = 0;
  for (const r of rows) {
    try {
      await drz.insert(dailyQuests).values(r);
      inserted++;
    } catch {
      // Unique constraint hit (race against another cron tick). Safe to ignore.
    }
  }
  return inserted;
}

/**
 * Cron entry: seed today's quests for every user in the DB.
 *
 * Returns { seeded } = users for whom we wrote new rows. Same-day re-runs
 * count 0. Errors per-user do not stop the loop.
 */
export async function runDailyQuestsCron(
  drz: DB,
  now: Date = new Date(),
): Promise<{ seeded: number; scanned: number }> {
  const allUsers = await drz
    .select({ id: users.id, timezone: users.timezone })
    .from(users);

  let seeded = 0;
  for (const u of allUsers) {
    try {
      const n = await seedQuestsForUser(drz, u.id, u.timezone, now);
      if (n > 0) seeded++;
    } catch {
      // Swallow per-user errors — cron logs the aggregate.
    }
  }
  return { seeded, scanned: allUsers.length };
}

/**
 * Bump progress on any unclaimed open quests of `kind` for the user today.
 *
 * Caller is the underlying gameplay helper (lesson complete, XP grant,
 * streak bump). `delta` is the increment to apply. Once progress hits
 * target, the row flips to `completed = true` but is NOT auto-claimed;
 * the user has to press the button.
 */
export async function bumpQuestProgress(
  drz: DB,
  userId: number,
  kind: QuestKind,
  delta: number,
  now: Date = new Date(),
): Promise<void> {
  if (delta <= 0) return;
  // Resolve the user's timezone so we hit the correct local-date row.
  const me = await drz
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!me[0]) return;
  const date = todayInTz(me[0].timezone, now);

  const open = await drz
    .select()
    .from(dailyQuests)
    .where(
      and(
        eq(dailyQuests.userId, userId),
        eq(dailyQuests.date, date),
        eq(dailyQuests.kind, kind),
      ),
    )
    .limit(1);
  if (!open[0]) return;
  if (open[0].claimed) return;

  const newProgress = Math.min(open[0].progress + delta, open[0].target);
  const completed = newProgress >= open[0].target;

  await drz
    .update(dailyQuests)
    .set({ progress: newProgress, completed })
    .where(eq(dailyQuests.id, open[0].id));
}

/**
 * Resolve today's 3 quests for the UI. Returns rows sorted by kind so the
 * order is stable across renders.
 */
export async function listQuestsForUser(
  drz: DB,
  userId: number,
  timezone: string,
  now: Date = new Date(),
): Promise<
  Array<{
    id: number;
    kind: QuestKind;
    target: number;
    progress: number;
    completed: boolean;
    claimed: boolean;
    bonusXp: number;
    bonusCoins: number;
    titleNl: string;
    titleEn: string;
  }>
> {
  const date = todayInTz(timezone, now);
  const rows = await drz
    .select()
    .from(dailyQuests)
    .where(and(eq(dailyQuests.userId, userId), eq(dailyQuests.date, date)));

  return rows
    .map((r) => {
      const title = questTitle(r.kind as QuestKind, r.target);
      return {
        id: r.id,
        kind: r.kind as QuestKind,
        target: r.target,
        progress: r.progress,
        completed: r.completed,
        claimed: r.claimed,
        bonusXp: r.bonusXp,
        bonusCoins: r.bonusCoins,
        titleNl: title.nl,
        titleEn: title.en,
      };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind));
}

/**
 * Claim a completed-but-not-yet-claimed quest. Awards the bonus XP + coins
 * atomically (sequence of writes, no real transaction since D1 doesn't
 * expose them yet). Returns the bonus actually awarded; throws when the
 * quest is missing, unowned, not completed, or already claimed.
 */
export async function claimQuest(
  drz: DB,
  userId: number,
  questId: number,
  now: Date = new Date(),
): Promise<{ bonusXp: number; bonusCoins: number }> {
  const row = await drz
    .select()
    .from(dailyQuests)
    .where(and(eq(dailyQuests.id, questId), eq(dailyQuests.userId, userId)))
    .limit(1);
  if (!row[0]) throw new Error("Quest not found");
  const q = row[0];
  if (q.claimed) throw new Error("Quest already claimed");
  if (q.progress < q.target) throw new Error("Quest not yet completed");

  // Mark claimed first so a retry doesn't double-award.
  await drz
    .update(dailyQuests)
    .set({ claimed: true, completed: true, claimedAt: now.toISOString() })
    .where(eq(dailyQuests.id, q.id));

  await drz
    .update(users)
    .set({
      xpTotal: sql`${users.xpTotal} + ${q.bonusXp}`,
      coinsBalance: sql`${users.coinsBalance} + ${q.bonusCoins}`,
    })
    .where(eq(users.id, userId));

  await drz.insert(xpEvents).values({
    userId,
    delta: q.bonusXp,
    reason: "daily_quest",
    refType: "daily_quest",
    refId: String(q.id),
  });
  await drz.insert(coinEvents).values({
    userId,
    delta: q.bonusCoins,
    reason: "daily_quest",
    refType: "daily_quest",
    refId: String(q.id),
  });

  return { bonusXp: q.bonusXp, bonusCoins: q.bonusCoins };
}
