/**
 * Daily-nag cron: send a web push to every user whose reminder_hour is the
 * current UTC hour AND who hasn't completed a lesson today AND who has
 * notifications enabled.
 *
 * Hooked into the existing 0 * * * * trigger by entry.server.ts scheduled().
 *
 * No-ops cleanly when VAPID secrets aren't configured yet, so the cron can
 * roll out before the operator generates and uploads keys.
 */
import type { DB } from "../../db/client";
import type { WorkerEnv } from "../../entry.server";
import { users, dailyCompletions } from "../../db/schema";
import { and, eq, sql } from "drizzle-orm";
import { sendPushToUser } from "./web-push";

export async function runDailyPushCron(
  drz: DB,
  env: WorkerEnv,
): Promise<{ targeted: number; sent: number }> {
  if (!env.VAPID_PUBLIC || !env.VAPID_PRIVATE || !env.VAPID_SUBJECT) {
    return { targeted: 0, sent: 0 };
  }

  const hour = new Date().getUTCHours();
  const today = new Date().toISOString().slice(0, 10);

  // Find candidate users: reminder hour matches, reminder enabled, AND
  // no daily_completions row for today.
  const candidates = await drz
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.reminderEnabled, true),
        eq(users.reminderHour, hour),
        sql`NOT EXISTS (
          SELECT 1 FROM ${dailyCompletions}
          WHERE ${dailyCompletions.userId} = ${users.id}
            AND ${dailyCompletions.date} = ${today}
        )`,
      ),
    );

  let sent = 0;
  for (const u of candidates) {
    try {
      const results = await sendPushToUser(drz, env, u.id, {
        topic: "daily-nag",
        urgency: "normal",
        ttlSeconds: 6 * 60 * 60, // 6h
      });
      sent += results.filter((r) => r.status >= 200 && r.status < 300).length;
    } catch (err) {
      console.error("[cron-push] user", u.id, "failed:", err);
    }
  }

  return { targeted: candidates.length, sent };
}
