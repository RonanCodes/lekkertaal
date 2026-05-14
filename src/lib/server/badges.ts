/**
 * Badge eligibility + award engine.
 *
 * Call awardBadgesIfEligible(drz, userId) after any event that could move the
 * user's totals (lesson complete, roleplay grade, xp event). It's idempotent
 * because of the unique (user_id, badge_id) index on user_badges.
 *
 * Rule kinds (matching the 15 seeded badges):
 *  - lessons_completed: threshold lessons in user_lesson_progress (completed).
 *  - streak_days:       users.streak_days >= threshold.
 *  - xp_total:          users.xp_total >= threshold.
 *  - roleplays_passed:  count(roleplay_sessions where passed = 1).
 *  - perfect_lesson:    user_lesson_progress with incorrect_count = 0 exists.
 *  - vocab_learned:     spaced_rep_queue rows where item_type='vocab' and
 *                       repetitions >= 3 (proxy for "learned"). Threshold-gated.
 *  - units_completed:   user_unit_progress with status='completed'.
 *  - practice_before / practice_after: peek at the most recent
 *    daily_completions hour-of-day. Best-effort: we approximate using ISO
 *    creation timestamp's UTC hour (no per-user TZ math in v0).
 */
import type { DB } from "../../db/client";
import {
  users,
  badges,
  userBadges,
  userLessonProgress,
  userUnitProgress,
  roleplaySessions,
  spacedRepQueue,
  xpEvents,
} from "../../db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

type BadgeRule = {
  kind: string;
  threshold?: number;
  key?: string;
};

export type AwardedBadge = {
  id: number;
  slug: string;
  titleEn: string;
  titleNl: string;
  iconEmoji: string | null;
};

export async function awardBadgesIfEligible(
  drz: DB,
  userId: number,
): Promise<AwardedBadge[]> {
  const me = await drz.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!me[0]) return [];

  const allBadges = await drz.select().from(badges);
  const owned = await drz
    .select({ badgeId: userBadges.badgeId })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));
  const ownedSet = new Set(owned.map((o) => o.badgeId));

  const newlyAwarded: AwardedBadge[] = [];

  for (const b of allBadges) {
    if (ownedSet.has(b.id)) continue;
    const rule = (b.rule ?? {}) as BadgeRule;
    if (!rule.kind) continue;

    const eligible = await checkRule(drz, userId, me[0], rule);
    if (!eligible) continue;

    try {
      await drz.insert(userBadges).values({ userId, badgeId: b.id });
      newlyAwarded.push({
        id: b.id,
        slug: b.slug,
        titleEn: b.titleEn,
        titleNl: b.titleNl,
        iconEmoji: b.iconEmoji,
      });
    } catch {
      // Race-condition tolerant — the unique index does the dedupe.
    }
  }

  return newlyAwarded;
}

async function checkRule(
  drz: DB,
  userId: number,
  user: typeof users.$inferSelect,
  rule: BadgeRule,
): Promise<boolean> {
  const threshold = rule.threshold ?? 1;

  switch (rule.kind) {
    case "streak_days":
      return user.streakDays >= threshold;

    case "xp_total":
      return user.xpTotal >= threshold;

    case "lessons_completed": {
      const rows = await drz
        .select({ c: sql<number>`count(*)` })
        .from(userLessonProgress)
        .where(
          and(
            eq(userLessonProgress.userId, userId),
            eq(userLessonProgress.status, "completed"),
          ),
        );
      return (rows[0]?.c ?? 0) >= threshold;
    }

    case "roleplays_passed": {
      const rows = await drz
        .select({ c: sql<number>`count(*)` })
        .from(roleplaySessions)
        .where(
          and(eq(roleplaySessions.userId, userId), eq(roleplaySessions.passed, true)),
        );
      return (rows[0]?.c ?? 0) >= threshold;
    }

    case "perfect_lesson": {
      const rows = await drz
        .select({ id: userLessonProgress.id })
        .from(userLessonProgress)
        .where(
          and(
            eq(userLessonProgress.userId, userId),
            eq(userLessonProgress.status, "completed"),
            eq(userLessonProgress.incorrectCount, 0),
          ),
        )
        .limit(1);
      return rows.length > 0;
    }

    case "units_completed": {
      const rows = await drz
        .select({ c: sql<number>`count(*)` })
        .from(userUnitProgress)
        .where(
          and(
            eq(userUnitProgress.userId, userId),
            eq(userUnitProgress.status, "completed"),
          ),
        );
      return (rows[0]?.c ?? 0) >= threshold;
    }

    case "vocab_learned": {
      // Proxy: spaced-rep rows with repetitions >= 3 are "internalised".
      const rows = await drz
        .select({ c: sql<number>`count(*)` })
        .from(spacedRepQueue)
        .where(
          and(
            eq(spacedRepQueue.userId, userId),
            eq(spacedRepQueue.itemType, "vocab"),
            gte(spacedRepQueue.repetitions, 3),
          ),
        );
      return (rows[0]?.c ?? 0) >= threshold;
    }

    case "practice_before":
    case "practice_after": {
      // Look at xp_events created_at hour-of-day in UTC. Practice-before is
      // earliest-hour < threshold; practice-after is latest-hour > threshold.
      // Acceptable for v0; per-user TZ math lands when we materialise it.
      const eventRows = await drz
        .select({ createdAt: xpEvents.createdAt })
        .from(xpEvents)
        .where(eq(xpEvents.userId, userId));
      for (const ev of eventRows) {
        const hour = new Date(ev.createdAt).getUTCHours();
        if (rule.kind === "practice_before" && hour < threshold) return true;
        if (rule.kind === "practice_after" && hour >= threshold) return true;
      }
      return false;
    }

    default:
      // Unknown rule — never award rather than risk false positives.
      return false;
  }
}

export const PROFILE_BADGE_SUMMARY_LIMIT = 30;

/** Read all badges (locked + unlocked) for the profile grid. */
export async function getProfileBadges(
  drz: DB,
  userId: number,
): Promise<
  Array<{
    id: number;
    slug: string;
    titleEn: string;
    titleNl: string;
    description: string | null;
    iconEmoji: string | null;
    awarded: boolean;
    awardedAt: string | null;
  }>
> {
  const all = await drz.select().from(badges);
  const owned = await drz
    .select()
    .from(userBadges)
    .where(eq(userBadges.userId, userId));
  const ownedByBadgeId = new Map(owned.map((o) => [o.badgeId, o.awardedAt]));

  return all.map((b) => ({
    id: b.id,
    slug: b.slug,
    titleEn: b.titleEn,
    titleNl: b.titleNl,
    description: b.description,
    iconEmoji: b.iconEmoji,
    awarded: ownedByBadgeId.has(b.id),
    awardedAt: ownedByBadgeId.get(b.id) ?? null,
  }));
}
