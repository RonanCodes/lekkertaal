/**
 * In-app notification helpers.
 *
 * `notification_log` is shared with push/email cron jobs (see `email.ts`).
 * Rows written with `channel = 'in_app'` are intended for the in-app inbox
 * surfaced by the bell + dropdown in `AppShell`. A row stays "unread" while
 * `read_at IS NULL`; the inbox endpoint filters on that.
 *
 * Pure DB-side helpers that take a Drizzle handle. The HTTP layer in
 * `src/routes/api.notifications.*.ts` wraps these for auth + JSON shaping.
 * Tests exercise them against the in-memory better-sqlite3 D1 harness.
 *
 * Friend-only filter: the only `in_app` kind today is `peer_drill_completed`,
 * whose `result` column holds the peer-drill id. The submitter is already
 * verified as an accepted friend before the row is inserted (see
 * `submitPeerDrill`), so the inbox does NOT re-verify friendship at read
 * time. If a new `in_app` kind is added that does not pre-verify friendship,
 * the producer side is responsible — the reader trusts the row's `user_id`.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "../../db/client";
import { notificationLog, peerDrills, users } from "../../db/schema";

export type InboxNotification = {
  id: number;
  kind: string;
  sentAt: string;
  /** Free-form payload from `notification_log.result`. */
  result: string | null;
  /** Best-effort deep link for the UI to navigate to on click. */
  link: string | null;
  /** Display name of the person who triggered the notification, if any. */
  fromDisplayName: string | null;
};

/**
 * Build a deep link for a notification. Only `peer_drill_completed` has one
 * today; other `in_app` kinds fall back to null.
 */
function deepLinkFor(kind: string, _result: string | null): string | null {
  switch (kind) {
    case "peer_drill_completed":
      return "/app/peer";
    default:
      return null;
  }
}

/**
 * List unread in-app notifications for `userId`, newest first.
 *
 * Hard-capped at `limit` rows (default 20) so a busy account does not pull
 * an unbounded list into the dropdown.
 */
export async function listInbox(
  drz: DB,
  userId: number,
  limit = 20,
): Promise<InboxNotification[]> {
  const rows = await drz
    .select({
      id: notificationLog.id,
      kind: notificationLog.kind,
      sentAt: notificationLog.sentAt,
      result: notificationLog.result,
      // Best-effort sender lookup: for peer_drill_completed the `result` is
      // the peer_drills.id, so we LEFT JOIN to grab the submitter's name. For
      // other kinds the join just returns NULLs and the UI falls back.
      fromDisplayName: users.displayName,
    })
    .from(notificationLog)
    .leftJoin(
      peerDrills,
      and(
        eq(notificationLog.kind, "peer_drill_completed"),
        sql`CAST(${notificationLog.result} AS INTEGER) = ${peerDrills.id}`,
      ),
    )
    .leftJoin(users, eq(users.id, peerDrills.toUserId))
    .where(
      and(
        eq(notificationLog.userId, userId),
        eq(notificationLog.channel, "in_app"),
        isNull(notificationLog.readAt),
      ),
    )
    .orderBy(desc(notificationLog.sentAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    sentAt: r.sentAt,
    result: r.result,
    link: deepLinkFor(r.kind, r.result),
    fromDisplayName: r.fromDisplayName,
  }));
}

/**
 * Mark a single notification as read for `userId`. Returns true if a row was
 * updated, false if no matching unread row exists (already read, wrong user,
 * or unknown id). Idempotent: a second call is a no-op that returns false.
 */
export async function markRead(
  drz: DB,
  notificationId: number,
  userId: number,
): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await drz
    .update(notificationLog)
    .set({ readAt: now })
    .where(
      and(
        eq(notificationLog.id, notificationId),
        eq(notificationLog.userId, userId),
        eq(notificationLog.channel, "in_app"),
        isNull(notificationLog.readAt),
      ),
    )
    .returning({ id: notificationLog.id });
  return result.length > 0;
}
