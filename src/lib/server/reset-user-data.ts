/**
 * "Reset my learning data" server helper.
 *
 * Deletes every user-scoped row across the progress / engagement / social
 * tables, then resets the corresponding aggregate fields on the `users` row.
 * The `users` row itself stays so the caller remains signed in; auth state
 * (Clerk session, clerkId, email, displayName, cefrLevel, timezone, reminder
 * prefs) is untouched.
 *
 * Used by the profile page "Reset my learning data" button. Implemented as a
 * separate module so the destructive logic is testable in isolation against
 * an in-memory SQLite via the existing test-db helper.
 *
 * Tables cleared (user-scoped rows only):
 *  - xp_events, coin_events
 *  - daily_completions, daily_quests
 *  - user_lesson_progress, user_unit_progress
 *  - friendships (both directions: requester or addressee = me)
 *  - peer_drills    (both directions: fromUserId or toUserId = me)
 *  - leagues
 *  - roleplay_sessions, roleplay_errors
 *  - transcripts, speak_drill_attempts
 *  - chat_messages
 *  - spaced_rep_queue
 *  - notification_log
 *  - user_badges
 *  - push_subscriptions
 *
 * Aggregate fields reset on `users`:
 *  - xp_total, coins_balance, hints_balance       → 0
 *  - streak_days, streak_freezes_balance          → 0
 *  - streak_last_active_date                       → null
 *  - onboarded_at                                  → preserved (account survives)
 *
 * NOTE: the issue body mentions `current_unit` + `current_unit_lessons_completed`
 * on `users`, but those columns do not exist in the current schema (unit
 * progression is tracked solely via `user_unit_progress` rows). Clearing
 * `user_unit_progress` is sufficient; the path loader will re-seed the first
 * unit when the user lands on /app/path. No schema change needed.
 */
import type { DB } from "../../db/client";
import {
  users,
  xpEvents,
  coinEvents,
  dailyCompletions,
  dailyQuests,
  userLessonProgress,
  userUnitProgress,
  friendships,
  peerDrills,
  leagues,
  roleplaySessions,
  roleplayErrors,
  transcripts,
  speakDrillAttempts,
  chatMessages,
  spacedRepQueue,
  notificationLog,
  userBadges,
  pushSubscriptions,
} from "../../db/schema";
import { eq, or } from "drizzle-orm";

export interface ResetUserDataResult {
  userId: number;
  cleared: string[];
}

/**
 * Wipe every user-scoped row for `userId` and reset aggregate columns on
 * the user's `users` row. Returns the list of table names cleared (for
 * audit logging and tests).
 *
 * D1 does not support multi-statement transactions across awaits, so each
 * delete is its own statement. Order is not important because we never
 * read between deletes; FK cascades on the schema would also handle most
 * of these via `users` deletion, but we want to keep the user row.
 */
export async function resetUserData(drz: DB, userId: number): Promise<ResetUserDataResult> {
  const cleared: string[] = [];

  await drz.delete(xpEvents).where(eq(xpEvents.userId, userId));
  cleared.push("xp_events");

  await drz.delete(coinEvents).where(eq(coinEvents.userId, userId));
  cleared.push("coin_events");

  await drz.delete(dailyCompletions).where(eq(dailyCompletions.userId, userId));
  cleared.push("daily_completions");

  await drz.delete(dailyQuests).where(eq(dailyQuests.userId, userId));
  cleared.push("daily_quests");

  await drz.delete(userLessonProgress).where(eq(userLessonProgress.userId, userId));
  cleared.push("user_lesson_progress");

  await drz.delete(userUnitProgress).where(eq(userUnitProgress.userId, userId));
  cleared.push("user_unit_progress");

  // Friendships: both sides — me as requester OR me as addressee.
  await drz
    .delete(friendships)
    .where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));
  cleared.push("friendships");

  // Peer drills: both sides.
  await drz
    .delete(peerDrills)
    .where(or(eq(peerDrills.fromUserId, userId), eq(peerDrills.toUserId, userId)));
  cleared.push("peer_drills");

  await drz.delete(leagues).where(eq(leagues.userId, userId));
  cleared.push("leagues");

  // Roleplay errors must die before roleplay_sessions because the errors row
  // FKs back to a session, but we cascade them via the explicit delete to
  // avoid relying on ON DELETE CASCADE semantics in every driver.
  await drz.delete(roleplayErrors).where(eq(roleplayErrors.userId, userId));
  cleared.push("roleplay_errors");

  await drz.delete(chatMessages).where(eq(chatMessages.userId, userId));
  cleared.push("chat_messages");

  await drz.delete(roleplaySessions).where(eq(roleplaySessions.userId, userId));
  cleared.push("roleplay_sessions");

  await drz.delete(transcripts).where(eq(transcripts.userId, userId));
  cleared.push("transcripts");

  await drz.delete(speakDrillAttempts).where(eq(speakDrillAttempts.userId, userId));
  cleared.push("speak_drill_attempts");

  await drz.delete(spacedRepQueue).where(eq(spacedRepQueue.userId, userId));
  cleared.push("spaced_rep_queue");

  await drz.delete(notificationLog).where(eq(notificationLog.userId, userId));
  cleared.push("notification_log");

  await drz.delete(userBadges).where(eq(userBadges.userId, userId));
  cleared.push("user_badges");

  await drz.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  cleared.push("push_subscriptions");

  // Reset aggregate fields on the users row. Keep clerkId, email,
  // displayName, cefrLevel, timezone, reminder prefs, isPublic, sfxEnabled,
  // onboardedAt — those are account, not learning state.
  await drz
    .update(users)
    .set({
      xpTotal: 0,
      coinsBalance: 0,
      hintsBalance: 0,
      streakDays: 0,
      streakFreezesBalance: 0,
      streakLastActiveDate: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId));
  cleared.push("users (aggregates reset)");

  return { userId, cleared };
}
