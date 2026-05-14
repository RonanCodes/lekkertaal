/**
 * Integration tests for the speak-drill record helper (P2-STT-3 #56).
 *
 * Covers:
 *   - Pass (score >= 80) on first attempt awards XP, inserts xp_event,
 *     bumps daily-quest speak progress, and logs a passed attempt row.
 *   - Pass on a drill already passed earlier is logged but awards 0 XP.
 *   - Fail (score < 80) logs an attempt row with passed=false and 0 XP.
 *   - Score clamping: scores above 100 / below 0 are clamped before passing.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { eq, and } from "drizzle-orm";
import {
  speakDrillAttempts,
  xpEvents,
  users,
  exercises,
  dailyQuests,
} from "../../../db/schema";
import { asD1, makeTestDb, seedUser, type TestDb } from "./test-db";
import {
  recordSpeakAttempt,
  SPEAK_XP_REWARD,
  SPEAK_PASS_THRESHOLD,
} from "../speak-drill";

function seedExercise(drz: TestDb, slug: string): number {
  const r = drz.$sqlite
    .prepare(
      `INSERT INTO exercises (slug, type, prompt_en, answer)
       VALUES (?, 'speak', 'Say it', ?)`,
    )
    .run(slug, JSON.stringify("Goedemorgen"));
  return Number(r.lastInsertRowid);
}

function seedSpeakQuest(drz: TestDb, userId: number): number {
  const today = new Date().toISOString().slice(0, 10);
  const r = drz.$sqlite
    .prepare(
      `INSERT INTO daily_quests (user_id, date, kind, target, progress, completed, claimed, bonus_xp, bonus_coins)
       VALUES (?, ?, 'speak', 2, 0, 0, 0, 15, 5)`,
    )
    .run(userId, today);
  return Number(r.lastInsertRowid);
}

let drz: TestDb;
let userId: number;
let drillId: number;

beforeEach(() => {
  drz = makeTestDb();
  userId = seedUser(drz);
  drillId = seedExercise(drz, "a1-01-speak-1");
});

describe("recordSpeakAttempt", () => {
  it("awards XP + bumps quests on first pass", async () => {
    seedSpeakQuest(drz, userId);

    const result = await recordSpeakAttempt(asD1(drz), {
      userId,
      drillId,
      score: 92,
      transcript: "Goedemorgen",
      audioKey: "stt/1/abc.webm",
    });

    expect(result.passed).toBe(true);
    expect(result.alreadyAwarded).toBe(false);
    expect(result.xpAwarded).toBe(SPEAK_XP_REWARD);

    const rows = await asD1(drz).select().from(speakDrillAttempts);
    expect(rows).toHaveLength(1);
    expect(rows[0].score).toBe(92);
    expect(rows[0].passed).toBe(true);
    expect(rows[0].xpAwarded).toBe(SPEAK_XP_REWARD);

    const xpRows = await asD1(drz)
      .select()
      .from(xpEvents)
      .where(eq(xpEvents.userId, userId));
    expect(xpRows).toHaveLength(1);
    expect(xpRows[0].delta).toBe(SPEAK_XP_REWARD);
    expect(xpRows[0].reason).toBe("speak_drill_pass");

    const u = await asD1(drz).select().from(users).where(eq(users.id, userId));
    expect(u[0].xpTotal).toBe(SPEAK_XP_REWARD);

    const quest = await asD1(drz)
      .select()
      .from(dailyQuests)
      .where(and(eq(dailyQuests.userId, userId), eq(dailyQuests.kind, "speak")));
    expect(quest[0].progress).toBe(1);
  });

  it("does not double-award XP on a repeat pass of the same drill", async () => {
    await recordSpeakAttempt(asD1(drz), {
      userId,
      drillId,
      score: 95,
      transcript: "Goedemorgen",
      audioKey: null,
    });
    const second = await recordSpeakAttempt(asD1(drz), {
      userId,
      drillId,
      score: 100,
      transcript: "Goedemorgen",
      audioKey: null,
    });

    expect(second.passed).toBe(true);
    expect(second.alreadyAwarded).toBe(true);
    expect(second.xpAwarded).toBe(0);

    const rows = await asD1(drz).select().from(speakDrillAttempts);
    expect(rows).toHaveLength(2);

    const xpRows = await asD1(drz)
      .select()
      .from(xpEvents)
      .where(eq(xpEvents.userId, userId));
    expect(xpRows).toHaveLength(1);
  });

  it("logs a failed attempt without awarding XP", async () => {
    const result = await recordSpeakAttempt(asD1(drz), {
      userId,
      drillId,
      score: 40,
      transcript: "morgen",
      audioKey: null,
    });

    expect(result.passed).toBe(false);
    expect(result.xpAwarded).toBe(0);

    const rows = await asD1(drz).select().from(speakDrillAttempts);
    expect(rows).toHaveLength(1);
    expect(rows[0].passed).toBe(false);
    expect(rows[0].xpAwarded).toBe(0);

    const xpRows = await asD1(drz).select().from(xpEvents);
    expect(xpRows).toHaveLength(0);
  });

  it("clamps out-of-range scores before deciding pass/fail", async () => {
    const high = await recordSpeakAttempt(asD1(drz), {
      userId,
      drillId,
      score: 9999,
      transcript: "ok",
      audioKey: null,
    });
    expect(high.passed).toBe(true);

    const otherDrill = seedExercise(drz, "a1-01-speak-2");
    const low = await recordSpeakAttempt(asD1(drz), {
      userId,
      drillId: otherDrill,
      score: -50,
      transcript: "x",
      audioKey: null,
    });
    expect(low.passed).toBe(false);

    const stored = await asD1(drz).select().from(speakDrillAttempts);
    const scores = stored.map((r) => r.score).sort((a, b) => a - b);
    expect(scores).toEqual([0, 100]);
  });

  it("matches the documented pass threshold", () => {
    expect(SPEAK_PASS_THRESHOLD).toBe(80);
  });
});

describe("schema sanity", () => {
  it("exercises seeded for the test fixture have type=speak", async () => {
    const rows = await asD1(drz)
      .select()
      .from(exercises)
      .where(eq(exercises.id, drillId));
    expect(rows[0].type).toBe("speak");
  });
});
