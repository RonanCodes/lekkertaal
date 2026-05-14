/**
 * Speak-drill side-effects (P2-STT-3 #56).
 *
 * The /api/stt/speak-complete route delegates to `recordSpeakAttempt` so the
 * award-XP-once + bump-quest logic can be tested against an in-memory SQLite
 * without spinning up a Cloudflare runtime.
 *
 * Algorithm:
 *   1. Decide passed = score >= SPEAK_PASS_THRESHOLD.
 *   2. If passed AND no prior passing row exists for (userId, drillId), award
 *      SPEAK_XP_REWARD; otherwise xpAwarded = 0.
 *   3. Insert a `speak_drill_attempts` row regardless (retries are logged).
 *   4. If XP was awarded, bump users.xpTotal + xp_events + daily-quest speak
 *      progress + daily-quest xp progress.
 */
import type { DB } from "../../db/client";
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { speakDrillAttempts, users, xpEvents } from "../../db/schema";
import { bumpQuestProgress } from "./daily-quests";

/** Score threshold above which a speak drill counts as a pass. */
export const SPEAK_PASS_THRESHOLD = 80;
/** XP awarded on first pass of a given drill. */
export const SPEAK_XP_REWARD = 5;

export type RecordSpeakAttemptArgs = {
  userId: number;
  drillId: number;
  score: number;
  transcript: string;
  audioKey: string | null;
};

export type RecordSpeakAttemptResult = {
  passed: boolean;
  xpAwarded: number;
  alreadyAwarded: boolean;
};

export async function recordSpeakAttempt(
  drz: DB,
  args: RecordSpeakAttemptArgs,
): Promise<RecordSpeakAttemptResult> {
  const { userId, drillId, transcript, audioKey } = args;
  const score = Math.max(0, Math.min(100, Math.round(args.score)));
  const passed = score >= SPEAK_PASS_THRESHOLD;

  let xpAwarded = 0;
  let alreadyAwarded = false;

  if (passed) {
    const prior = await drz
      .select({ id: speakDrillAttempts.id })
      .from(speakDrillAttempts)
      .where(
        and(
          eq(speakDrillAttempts.userId, userId),
          eq(speakDrillAttempts.drillId, drillId),
          eq(speakDrillAttempts.passed, true),
        ),
      )
      .limit(1);
    if (prior[0]) {
      alreadyAwarded = true;
    } else {
      xpAwarded = SPEAK_XP_REWARD;
    }
  }

  await drz.insert(speakDrillAttempts).values({
    userId,
    drillId,
    score,
    passed,
    transcript,
    audioKey,
    xpAwarded,
  });

  if (xpAwarded > 0) {
    await drz
      .update(users)
      .set({ xpTotal: sql`${users.xpTotal} + ${xpAwarded}` })
      .where(eq(users.id, userId));
    await drz.insert(xpEvents).values({
      userId,
      delta: xpAwarded,
      reason: "speak_drill_pass",
      refType: "drill",
      refId: String(drillId),
    });
    await bumpQuestProgress(drz, userId, "speak", 1);
    await bumpQuestProgress(drz, userId, "xp", xpAwarded);
  }

  return { passed, xpAwarded, alreadyAwarded };
}
