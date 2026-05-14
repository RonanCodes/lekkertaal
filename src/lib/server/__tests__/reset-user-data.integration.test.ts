/**
 * Integration tests for `resetUserData()` (issue #105).
 *
 * Drives the helper against the in-memory better-sqlite3 D1 harness so the
 * real Drizzle schema and migrations participate. Seeds rich state across
 * every user-scoped table (XP, coins, streak, daily completions, daily
 * quests, lesson/unit progress, friendships, peer drills, leagues, roleplay
 * sessions/errors, transcripts, speak-drill attempts, chat messages,
 * spaced-rep queue, notifications, badges, push subs), then asserts:
 *
 *   - every user-scoped row for the target user is deleted
 *   - rows belonging to a SECOND user survive (no over-deletion)
 *   - friendships and peer drills are cleared in both directions
 *   - the `users` row itself survives, with xp/coins/streak fields zeroed
 *     and clerkId / email / displayName / cefrLevel / timezone untouched
 */
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { resetUserData } from "../reset-user-data";
import { users, xpEvents, userLessonProgress } from "../../../db/schema";
import { makeTestDb, asD1 } from "./test-db";
import type { TestDb } from "./test-db";

function seedNamedUser(drz: TestDb, displayName: string): number {
  const result = drz.$sqlite
    .prepare(
      `INSERT INTO users (clerk_id, email, display_name, xp_total, coins_balance, hints_balance, streak_days, streak_freezes_balance, streak_last_active_date, cefr_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `clerk_${displayName.toLowerCase()}_${Math.random().toString(36).slice(2, 6)}`,
      `${displayName.toLowerCase()}@example.test`,
      displayName,
      500,
      120,
      3,
      14,
      2,
      "2026-05-10",
      "A2",
    );
  return Number(result.lastInsertRowid);
}

function seedSupportingContent(drz: TestDb) {
  // Course → unit → lesson → exercise → scenario, all minimal but valid FKs.
  drz.$sqlite
    .prepare(
      `INSERT INTO courses (slug, title, cefr_level) VALUES ('c1', 'Test course', 'A2')`,
    )
    .run();
  drz.$sqlite
    .prepare(
      `INSERT INTO units (course_id, slug, title_nl, title_en, cefr_level, "order") VALUES (1, 'u1', 'Unit 1', 'Unit 1', 'A2', 1)`,
    )
    .run();
  drz.$sqlite
    .prepare(
      `INSERT INTO lessons (unit_id, slug, title_nl, title_en, "order") VALUES (1, 'l1', 'Lesson 1', 'Lesson 1', 1)`,
    )
    .run();
  drz.$sqlite
    .prepare(
      `INSERT INTO exercises (lesson_id, slug, type, prompt_nl) VALUES (1, 'e1', 'translation_typing', 'hoi')`,
    )
    .run();
  drz.$sqlite
    .prepare(
      `INSERT INTO scenarios (unit_id, slug, title_nl, title_en, npc_name, npc_persona, opening_nl)
       VALUES (1, 'sc1', 'sc', 'sc', 'NPC', 'persona', 'Hallo')`,
    )
    .run();
  drz.$sqlite
    .prepare(
      `INSERT INTO badges (slug, title_nl, title_en) VALUES ('b1', 'b1', 'b1')`,
    )
    .run();
}

function seedFullUserState(drz: TestDb, userId: number, otherId: number) {
  // XP / coins / completions / quests
  drz.$sqlite
    .prepare(`INSERT INTO xp_events (user_id, delta, reason) VALUES (?, 30, 'lesson_complete')`)
    .run(userId);
  drz.$sqlite
    .prepare(`INSERT INTO coin_events (user_id, delta, reason) VALUES (?, 5, 'lesson_complete')`)
    .run(userId);
  drz.$sqlite
    .prepare(
      `INSERT INTO daily_completions (user_id, date, xp_earned, lessons_completed) VALUES (?, '2026-05-12', 50, 2)`,
    )
    .run(userId);
  drz.$sqlite
    .prepare(
      `INSERT INTO daily_quests (user_id, date, kind, target, progress) VALUES (?, '2026-05-12', 'xp', 50, 30)`,
    )
    .run(userId);

  // Lesson + unit progress
  drz.$sqlite
    .prepare(
      `INSERT INTO user_lesson_progress (user_id, lesson_id, status) VALUES (?, 1, 'completed')`,
    )
    .run(userId);
  drz.$sqlite
    .prepare(
      `INSERT INTO user_unit_progress (user_id, unit_id, status) VALUES (?, 1, 'in_progress')`,
    )
    .run(userId);

  // Friendships: me as requester AND me as addressee.
  drz.$sqlite
    .prepare(
      `INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'accepted')`,
    )
    .run(userId, otherId);
  drz.$sqlite
    .prepare(
      `INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')`,
    )
    .run(otherId, userId);

  // Peer drills: both directions.
  drz.$sqlite
    .prepare(
      `INSERT INTO peer_drills (from_user_id, to_user_id, prompt, status) VALUES (?, ?, 'translate hoi', 'pending')`,
    )
    .run(userId, otherId);
  drz.$sqlite
    .prepare(
      `INSERT INTO peer_drills (from_user_id, to_user_id, prompt, status) VALUES (?, ?, 'translate dag', 'completed')`,
    )
    .run(otherId, userId);

  // Leagues
  drz.$sqlite
    .prepare(
      `INSERT INTO leagues (user_id, tier, week_start_date, weekly_xp) VALUES (?, 2, '2026-05-11', 200)`,
    )
    .run(userId);

  // Roleplay session + error + chat message + transcript
  drz.$sqlite
    .prepare(
      `INSERT INTO roleplay_sessions (id, user_id, scenario_id, xp_awarded) VALUES (1, ?, 1, 25)`,
    )
    .run(userId);
  drz.$sqlite
    .prepare(
      `INSERT INTO roleplay_errors (session_id, user_id, category, incorrect, correction) VALUES (1, ?, 'grammar', 'ik ben gegaan', 'ik ben gegaan')`,
    )
    .run(userId);
  drz.$sqlite
    .prepare(
      `INSERT INTO chat_messages (session_id, user_id, client_message_id, role, parts) VALUES (1, ?, 'msg-1', 'user', '[]')`,
    )
    .run(userId);
  drz.$sqlite
    .prepare(
      `INSERT INTO transcripts (user_id, drill_id, audio_key, transcript, duration_ms) VALUES (?, 1, 'audio/k1.webm', 'hoi', 2000)`,
    )
    .run(userId);
  drz.$sqlite
    .prepare(
      `INSERT INTO speak_drill_attempts (user_id, drill_id, score, passed, transcript) VALUES (?, 1, 92, 1, 'hoi')`,
    )
    .run(userId);

  // Spaced-rep, notification log, badge, push sub
  drz.$sqlite
    .prepare(
      `INSERT INTO spaced_rep_queue (user_id, item_type, item_key, next_review_date) VALUES (?, 'vocab', 'k1', '2026-05-13')`,
    )
    .run(userId);
  drz.$sqlite
    .prepare(`INSERT INTO notification_log (user_id, channel, kind) VALUES (?, 'in_app', 'daily_nag')`)
    .run(userId);
  drz.$sqlite
    .prepare(`INSERT INTO user_badges (user_id, badge_id) VALUES (?, 1)`)
    .run(userId);
  drz.$sqlite
    .prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth_key) VALUES (?, 'https://e', 'p', 'a')`,
    )
    .run(userId);
}

describe("resetUserData (integration: in-memory D1)", () => {
  let drz: TestDb;
  let alice: number;
  let bob: number;

  beforeEach(() => {
    drz = makeTestDb();
    seedSupportingContent(drz);
    alice = seedNamedUser(drz, "Alice");
    bob = seedNamedUser(drz, "Bob");
    seedFullUserState(drz, alice, bob);
    // Bob keeps a single XP row + lesson progress so we can prove no
    // over-deletion across users.
    drz.$sqlite
      .prepare(`INSERT INTO xp_events (user_id, delta, reason) VALUES (?, 99, 'placement')`)
      .run(bob);
    drz.$sqlite
      .prepare(
        `INSERT INTO user_lesson_progress (user_id, lesson_id, status) VALUES (?, 1, 'completed')`,
      )
      .run(bob);
  });

  it("deletes every user-scoped row for the target user", async () => {
    const result = await resetUserData(asD1(drz), alice);

    // Helper: count rows in `tbl` filtered by `column` = alice.
    const count = (tableSqlName: string, column = "user_id"): number => {
      const row = drz.$sqlite
        .prepare(`SELECT COUNT(*) AS n FROM ${tableSqlName} WHERE ${column} = ?`)
        .get(alice) as { n: number };
      return row.n;
    };

    expect(count("xp_events")).toBe(0);
    expect(count("coin_events")).toBe(0);
    expect(count("daily_completions")).toBe(0);
    expect(count("daily_quests")).toBe(0);
    expect(count("user_lesson_progress")).toBe(0);
    expect(count("user_unit_progress")).toBe(0);
    expect(count("leagues")).toBe(0);
    expect(count("roleplay_errors")).toBe(0);
    expect(count("chat_messages")).toBe(0);
    expect(count("roleplay_sessions")).toBe(0);
    expect(count("transcripts")).toBe(0);
    expect(count("speak_drill_attempts")).toBe(0);
    expect(count("spaced_rep_queue")).toBe(0);
    expect(count("notification_log")).toBe(0);
    expect(count("user_badges")).toBe(0);
    expect(count("push_subscriptions")).toBe(0);

    // Friendships: both directions cleared.
    const aliceFriendships = drz.$sqlite
      .prepare(
        `SELECT COUNT(*) AS n FROM friendships WHERE requester_id = ? OR addressee_id = ?`,
      )
      .get(alice, alice) as { n: number };
    expect(aliceFriendships.n).toBe(0);

    // Peer drills: both directions cleared.
    const alicePeer = drz.$sqlite
      .prepare(
        `SELECT COUNT(*) AS n FROM peer_drills WHERE from_user_id = ? OR to_user_id = ?`,
      )
      .get(alice, alice) as { n: number };
    expect(alicePeer.n).toBe(0);

    // Cleared list is returned for the caller.
    expect(result.cleared).toContain("xp_events");
    expect(result.cleared).toContain("users (aggregates reset)");
  });

  it("resets aggregate fields on the users row without touching identity columns", async () => {
    await resetUserData(asD1(drz), alice);

    const me = await drz.select().from(users).where(eq(users.id, alice)).limit(1);
    expect(me).toHaveLength(1);
    expect(me[0].xpTotal).toBe(0);
    expect(me[0].coinsBalance).toBe(0);
    expect(me[0].hintsBalance).toBe(0);
    expect(me[0].streakDays).toBe(0);
    expect(me[0].streakFreezesBalance).toBe(0);
    expect(me[0].streakLastActiveDate).toBeNull();

    // Identity preserved.
    expect(me[0].displayName).toBe("Alice");
    expect(me[0].cefrLevel).toBe("A2");
    expect(me[0].email).toBe("alice@example.test");
    expect(me[0].clerkId).toMatch(/^clerk_alice_/);
  });

  it("does not over-delete: rows for other users survive", async () => {
    await resetUserData(asD1(drz), alice);

    const bobXp = await drz.select().from(xpEvents).where(eq(xpEvents.userId, bob));
    expect(bobXp).toHaveLength(1);
    expect(bobXp[0].delta).toBe(99);

    const bobLesson = await drz
      .select()
      .from(userLessonProgress)
      .where(eq(userLessonProgress.userId, bob));
    expect(bobLesson).toHaveLength(1);

    // Bob's users row untouched.
    const bobRow = await drz.select().from(users).where(eq(users.id, bob)).limit(1);
    expect(bobRow[0].xpTotal).toBe(500);
    expect(bobRow[0].streakDays).toBe(14);
  });
});
