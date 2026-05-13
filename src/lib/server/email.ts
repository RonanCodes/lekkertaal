/**
 * Resend-based transactional email + the two weekly/recovery cron senders.
 *
 *   sendEmail(env, { to, subject, html })  → POST to Resend
 *   runWeeklyDigestCron(drz, env)          → Sunday 10:00 UTC; one digest / user
 *   runStreakRecoveryCron(drz, env)        → daily; users whose streak reset
 *                                            yesterday from ≥ 3 days
 *
 * Both crons no-op cleanly when RESEND_API_KEY is missing so the hook can
 * ship before the operator wires the key.
 *
 * notification_log keeps both crons idempotent — we never double-send the
 * same (user, kind, date).
 */
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { WorkerEnv } from "../../entry.server";
import {
  users,
  xpEvents,
  userUnitProgress,
  userBadges,
  badges,
  notificationLog,
} from "../../db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

const FROM_ADDRESS = "Lekkertaal <noreply@lekkertaal.ronanconnolly.dev>";
const APP_URL = "https://lekkertaal.ronanconnolly.dev";

export async function sendEmail(
  env: WorkerEnv,
  msg: { to: string; subject: string; html: string },
): Promise<{ ok: boolean; status: number; body?: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, status: 0, body: "RESEND_API_KEY missing" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
    }),
  });
  return {
    ok: r.ok,
    status: r.status,
    body: r.ok ? undefined : (await r.text()).slice(0, 500),
  };
}

async function alreadySent(
  drz: DrizzleD1Database,
  userId: number,
  kind: string,
  sinceIso: string,
): Promise<boolean> {
  const rows = await drz
    .select({ id: notificationLog.id })
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.userId, userId),
        eq(notificationLog.kind, kind),
        eq(notificationLog.channel, "email"),
        gte(notificationLog.sentAt, sinceIso),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function logSend(
  drz: DrizzleD1Database,
  userId: number,
  kind: string,
  ok: boolean,
): Promise<void> {
  await drz.insert(notificationLog).values({
    userId,
    channel: "email",
    kind,
    result: ok ? "sent" : "failed",
    sentAt: new Date().toISOString(),
  });
}

// ============================================================================
// Weekly digest (Sunday 10:00 UTC)
// ============================================================================

export async function runWeeklyDigestCron(
  drz: DrizzleD1Database,
  env: WorkerEnv,
): Promise<{ targeted: number; sent: number }> {
  if (!env.RESEND_API_KEY) return { targeted: 0, sent: 0 };

  const now = new Date();
  if (now.getUTCDay() !== 0 || now.getUTCHours() !== 10) {
    return { targeted: 0, sent: 0 };
  }

  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const weekStartIso = weekStart.toISOString();

  // Eligible: users with an email AND at least one xp event in the past week.
  const candidates = await drz
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      streakDays: users.streakDays,
      xpTotal: users.xpTotal,
    })
    .from(users)
    .where(sql`${users.email} IS NOT NULL`);

  let sent = 0;
  for (const u of candidates) {
    if (!u.email) continue;
    if (await alreadySent(drz, u.id, "weekly_digest", weekStartIso)) continue;

    const weekXpRow = await drz
      .select({ s: sql<number>`coalesce(sum(${xpEvents.delta}), 0)` })
      .from(xpEvents)
      .where(
        and(
          eq(xpEvents.userId, u.id),
          gte(xpEvents.createdAt, weekStartIso),
        ),
      );
    const weekXp = Number(weekXpRow[0]?.s ?? 0);
    if (weekXp <= 0) continue; // skip cold users this week

    const unitsCompletedRow = await drz
      .select({ c: sql<number>`count(*)` })
      .from(userUnitProgress)
      .where(
        and(
          eq(userUnitProgress.userId, u.id),
          eq(userUnitProgress.status, "completed"),
        ),
      );
    const unitsCompleted = Number(unitsCompletedRow[0]?.c ?? 0);

    const newBadges = await drz
      .select({ titleEn: badges.titleEn, iconEmoji: badges.iconEmoji })
      .from(userBadges)
      .innerJoin(badges, eq(badges.id, userBadges.badgeId))
      .where(
        and(eq(userBadges.userId, u.id), gte(userBadges.awardedAt, weekStartIso)),
      );

    const html = renderWeeklyDigest({
      displayName: u.displayName,
      weekXp,
      streakDays: u.streakDays,
      xpTotal: u.xpTotal,
      unitsCompleted,
      newBadges,
    });

    const r = await sendEmail(env, {
      to: u.email,
      subject: `🎯 Je week: ${weekXp.toLocaleString()} XP earned`,
      html,
    });
    if (r.ok) sent++;
    await logSend(drz, u.id, "weekly_digest", r.ok);
  }

  return { targeted: candidates.length, sent };
}

function renderWeeklyDigest(d: {
  displayName: string;
  weekXp: number;
  streakDays: number;
  xpTotal: number;
  unitsCompleted: number;
  newBadges: Array<{ titleEn: string; iconEmoji: string | null }>;
}): string {
  const badgeList = d.newBadges
    .map((b) => `<li>${b.iconEmoji ?? "🏅"} ${escapeHtml(b.titleEn)}</li>`)
    .join("");
  return baseTemplate(`
    <h1 style="color:#ea580c">Hallo ${escapeHtml(d.displayName)}!</h1>
    <p>Your Lekkertaal week in numbers:</p>
    <ul>
      <li><strong>${d.weekXp.toLocaleString()} XP</strong> earned</li>
      <li>🔥 <strong>${d.streakDays}-day streak</strong></li>
      <li>📚 <strong>${d.unitsCompleted} units</strong> completed</li>
      <li>🌟 <strong>${d.xpTotal.toLocaleString()} total XP</strong></li>
    </ul>
    ${
      d.newBadges.length > 0
        ? `<h2 style="color:#ea580c">New badges this week</h2><ul>${badgeList}</ul>`
        : ""
    }
    <p style="margin-top:24px"><a href="${APP_URL}/app/path" style="background:#ea580c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Continue learning →</a></p>
  `);
}

// ============================================================================
// Streak-broken recovery (daily)
// ============================================================================

export async function runStreakRecoveryCron(
  drz: DrizzleD1Database,
  env: WorkerEnv,
): Promise<{ targeted: number; sent: number }> {
  if (!env.RESEND_API_KEY) return { targeted: 0, sent: 0 };

  // Throttle to once per day per user.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayStartIso = dayStart.toISOString();

  // Heuristic: users whose streak_days hit 0 today (i.e. recently reset).
  // Without a streak_history table we approximate by selecting users whose
  // streak_days === 0 AND streak_last_active_date IS NOT NULL (meaning they
  // had a streak previously) AND their last_active was within the last 3 days
  // (i.e. they were "around" recently and the reset is hot).
  const threeDaysAgo = new Date();
  threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
  const threeDaysAgoIso = threeDaysAgo.toISOString();

  const candidates = await drz
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      xpTotal: users.xpTotal,
    })
    .from(users)
    .where(
      sql`${users.email} IS NOT NULL
          AND ${users.streakDays} = 0
          AND ${users.streakLastActiveDate} IS NOT NULL
          AND ${users.streakLastActiveDate} >= ${threeDaysAgoIso.slice(0, 10)}`,
    );

  let sent = 0;
  for (const u of candidates) {
    if (!u.email) continue;
    if (await alreadySent(drz, u.id, "streak_recovery", dayStartIso)) continue;

    const html = renderStreakRecovery({
      displayName: u.displayName,
      xpTotal: u.xpTotal,
    });
    const r = await sendEmail(env, {
      to: u.email,
      subject: "🔥 Je reeks is gebroken — kom terug?",
      html,
    });
    if (r.ok) sent++;
    await logSend(drz, u.id, "streak_recovery", r.ok);
  }

  return { targeted: candidates.length, sent };
}

function renderStreakRecovery(d: { displayName: string; xpTotal: number }): string {
  return baseTemplate(`
    <h1 style="color:#ea580c">${escapeHtml(d.displayName)}, kom terug!</h1>
    <p>Je Nederlandse reeks is gebroken, maar ${d.xpTotal.toLocaleString()} XP is nog steeds van jou.</p>
    <p>Het kost 5 minuten om weer te beginnen. Eén les vandaag en je bent terug.</p>
    <p style="margin-top:24px"><a href="${APP_URL}/app/path" style="background:#ea580c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Start een nieuwe reeks →</a></p>
  `);
}

function baseTemplate(inner: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      ${inner}
      <hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb" />
      <p style="font-size:12px;color:#6b7280">
        You're receiving this because you signed up for Lekkertaal. To stop these emails, sign in and disable reminders.
      </p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
