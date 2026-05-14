/**
 * Peer-drill server helpers.
 *
 * One friend sends another a short Dutch sentence to translate. The DB shape
 * is a single `peer_drills` row with `from_user_id`, `to_user_id`, the prompt,
 * an optional answer-hint, and a status (`pending` | `completed` | `skipped`).
 *
 * Pure DB-side helpers that take a Drizzle handle. The HTTP layer in
 * `src/routes/api.peer-drills.*.ts` wraps these for auth + JSON shaping. Tests
 * exercise them against the in-memory better-sqlite3 D1 harness.
 *
 * Friendship guard: both `send` and `submit` require an `accepted` row in
 * either direction in `friendships` between the two user ids. The guard runs
 * before any insert/update so non-friends get a clean 403 with no side effects.
 *
 * Submission writes an in-app notification back to the sender by appending a
 * row to `notification_log` (channel = `in_app`, kind = `peer_drill_completed`).
 * This keeps the design backend-pluggable: the cron-push job already drains
 * `notification_log` for push/email, and a future inbox UI can surface
 * `in_app` rows directly.
 */
import { and, eq, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { friendships, notificationLog, peerDrills, users } from "../../db/schema";

export type PeerDrillStatus = "pending" | "completed" | "skipped";

export type PeerDrillErrorCode =
  | "user_not_found"
  | "self_drill"
  | "not_friends"
  | "drill_not_found"
  | "not_recipient"
  | "not_pending"
  | "empty_prompt"
  | "empty_answer";

export class PeerDrillError extends Error {
  constructor(public code: PeerDrillErrorCode, message?: string) {
    super(message ?? code);
  }
}

export type InboxEntry = {
  id: number;
  fromUserId: number;
  fromDisplayName: string;
  fromAvatarUrl: string | null;
  prompt: string;
  expectedAnswerHint: string | null;
  createdAt: string;
};

/**
 * Confirm two users are accepted friends (in either direction). Throws
 * PeerDrillError("not_friends") otherwise.
 */
async function requireAcceptedFriendship(
  drz: DrizzleD1Database,
  a: number,
  b: number,
): Promise<void> {
  const rows = await drz
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
          and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
        ),
      ),
    )
    .limit(1);
  if (!rows[0]) throw new PeerDrillError("not_friends");
}

/**
 * Send a drill from `fromUserId` to `toUserId`. The recipient must exist and
 * the pair must be accepted friends.
 *
 * Trims the prompt; rejects empty strings to keep the inbox clean.
 */
export async function sendPeerDrill(
  drz: DrizzleD1Database,
  fromUserId: number,
  toUserId: number,
  prompt: string,
  expectedAnswerHint?: string | null,
): Promise<{ id: number }> {
  if (fromUserId === toUserId) throw new PeerDrillError("self_drill");

  const trimmed = prompt.trim();
  if (!trimmed) throw new PeerDrillError("empty_prompt");

  const recipientRows = await drz
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, toUserId))
    .limit(1);
  if (!recipientRows[0]) throw new PeerDrillError("user_not_found");

  await requireAcceptedFriendship(drz, fromUserId, toUserId);

  const hint =
    typeof expectedAnswerHint === "string" && expectedAnswerHint.trim()
      ? expectedAnswerHint.trim()
      : null;

  const inserted = await drz
    .insert(peerDrills)
    .values({
      fromUserId,
      toUserId,
      prompt: trimmed,
      expectedAnswerHint: hint,
      status: "pending",
    })
    .returning({ id: peerDrills.id });

  return { id: inserted[0].id };
}

/**
 * List pending drills addressed to `userId`, newest first, with a denormalised
 * `from` display name for cheap UI rendering.
 */
export async function listInbox(
  drz: DrizzleD1Database,
  userId: number,
): Promise<InboxEntry[]> {
  const rows = await drz
    .select({
      id: peerDrills.id,
      fromUserId: peerDrills.fromUserId,
      prompt: peerDrills.prompt,
      expectedAnswerHint: peerDrills.expectedAnswerHint,
      createdAt: peerDrills.createdAt,
      fromDisplayName: users.displayName,
      fromAvatarUrl: users.avatarUrl,
    })
    .from(peerDrills)
    .innerJoin(users, eq(users.id, peerDrills.fromUserId))
    .where(and(eq(peerDrills.toUserId, userId), eq(peerDrills.status, "pending")))
    .orderBy(sql`${peerDrills.createdAt} DESC`);

  return rows.map((r) => ({
    id: r.id,
    fromUserId: r.fromUserId,
    fromDisplayName: r.fromDisplayName,
    fromAvatarUrl: r.fromAvatarUrl,
    prompt: r.prompt,
    expectedAnswerHint: r.expectedAnswerHint,
    createdAt: r.createdAt,
  }));
}

/**
 * Submit an answer for a pending drill. The caller must be the recipient and
 * the pair must still be accepted friends (defensive — if a friendship was
 * revoked between send and submit, this rejects). Marks the row `completed`,
 * stamps `completed_at`, and queues an in-app notification to the sender.
 */
export async function submitPeerDrill(
  drz: DrizzleD1Database,
  drillId: number,
  recipientId: number,
  answer: string,
): Promise<{ id: number; fromUserId: number }> {
  const trimmed = answer.trim();
  if (!trimmed) throw new PeerDrillError("empty_answer");

  const rows = await drz
    .select()
    .from(peerDrills)
    .where(eq(peerDrills.id, drillId))
    .limit(1);
  if (!rows[0]) throw new PeerDrillError("drill_not_found");
  const drill = rows[0];
  if (drill.toUserId !== recipientId) throw new PeerDrillError("not_recipient");
  if (drill.status !== "pending") throw new PeerDrillError("not_pending");

  await requireAcceptedFriendship(drz, drill.fromUserId, drill.toUserId);

  const now = new Date().toISOString();
  await drz
    .update(peerDrills)
    .set({ status: "completed", answer: trimmed, completedAt: now })
    .where(eq(peerDrills.id, drillId));

  await drz.insert(notificationLog).values({
    userId: drill.fromUserId,
    channel: "in_app",
    kind: "peer_drill_completed",
    result: String(drill.id),
  });

  return { id: drill.id, fromUserId: drill.fromUserId };
}
