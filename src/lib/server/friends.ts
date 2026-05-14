/**
 * Friends graph server helpers.
 *
 * Pure DB-side functions that take a Drizzle handle. The HTTP layer
 * (`src/routes/api.friends.*.ts`) is the thin wrapper that handles auth and
 * JSON shaping. Tests exercise these helpers directly against the in-memory
 * better-sqlite3 D1 harness in `src/lib/server/__tests__/test-db.ts`.
 *
 * Friendship rows live in a single direction (`requesterId` → `addresseeId`)
 * but the queries are symmetric: `list` and `pending` union both sides so
 * the user-facing "my friends" set is independent of who originally invited
 * whom.
 *
 * Status transitions:
 *   pending → accepted   (respond: accept)
 *   pending → declined   (respond: decline)
 *
 * Idempotency rules:
 *   - request when a `pending` row already exists between the pair (either
 *     direction): return the existing row unchanged.
 *   - request when an `accepted` row already exists: throw FriendshipError("already_friends") (409).
 *   - request when a `declined` row exists: insert a fresh `pending` row
 *     (re-invites allowed after decline).
 */
import { and, eq, or, sql } from "drizzle-orm";
import type { DB } from "../../db/client";
import { friendships, users } from "../../db/schema";

export type FriendshipStatus = "pending" | "accepted" | "declined";

export type FriendshipErrorCode =
  | "user_not_found"
  | "self_friend"
  | "already_friends"
  | "friendship_not_found"
  | "not_addressee"
  | "not_pending";

export class FriendshipError extends Error {
  constructor(public code: FriendshipErrorCode, message?: string) {
    super(message ?? code);
  }
}

export type FriendListEntry = {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  xpTotal: number;
  streakDays: number;
  friendshipId: number;
  since: string; // respondedAt
};

export type PendingRequestEntry = {
  friendshipId: number;
  requesterId: number;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

/**
 * Look up a user row by clerk-id. Used by the HTTP layer to resolve the
 * caller's numeric id once and pass it into the helpers below.
 */
export async function getUserIdByClerkId(
  drz: DB,
  clerkId: string,
): Promise<number | null> {
  const rows = await drz
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Resolve a user row by display-name (case-insensitive). Returns null if
 * unknown.
 */
export async function findUserByDisplayName(
  drz: DB,
  displayName: string,
): Promise<{ id: number; displayName: string } | null> {
  const rows = await drz
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(sql`lower(${users.displayName}) = lower(${displayName})`)
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Find any existing friendship row between two users, in either direction.
 */
async function findExistingFriendship(
  drz: DB,
  a: number,
  b: number,
): Promise<typeof friendships.$inferSelect | null> {
  const rows = await drz
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
        and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Create a friend request from `requesterId` to `addresseeUsername`.
 *
 * Throws FriendshipError for: self-friend, user not found, already-friends.
 * Returns the existing row when a pending request between the pair already
 * exists (in either direction), or a fresh row otherwise (including the
 * "re-invite after decline" path).
 */
export async function requestFriendship(
  drz: DB,
  requesterId: number,
  addresseeUsername: string,
): Promise<{ friendshipId: number; status: FriendshipStatus; createdFresh: boolean }> {
  const addressee = await findUserByDisplayName(drz, addresseeUsername);
  if (!addressee) throw new FriendshipError("user_not_found");
  if (addressee.id === requesterId) throw new FriendshipError("self_friend");

  const existing = await findExistingFriendship(drz, requesterId, addressee.id);
  if (existing) {
    if (existing.status === "accepted") {
      throw new FriendshipError("already_friends");
    }
    if (existing.status === "pending") {
      // Idempotent no-op: surface the same row.
      return {
        friendshipId: existing.id,
        status: "pending",
        createdFresh: false,
      };
    }
    // existing.status === "declined" — fall through to insert a fresh row.
    // We need to delete the declined row first because the unique pair index
    // forbids two rows for the same (requester, addressee). We delete only
    // the declined row that points the same direction as the new one (or in
    // either direction; both are valid pair-matches).
    await drz.delete(friendships).where(eq(friendships.id, existing.id));
  }

  const inserted = await drz
    .insert(friendships)
    .values({
      requesterId,
      addresseeId: addressee.id,
      status: "pending",
    })
    .returning({ id: friendships.id });
  return {
    friendshipId: inserted[0].id,
    status: "pending",
    createdFresh: true,
  };
}

/**
 * Respond to a pending request. Only the addressee can accept or decline.
 */
export async function respondToFriendship(
  drz: DB,
  responderId: number,
  friendshipId: number,
  action: "accept" | "decline",
): Promise<{ friendshipId: number; status: FriendshipStatus }> {
  const rows = await drz
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .limit(1);
  if (!rows[0]) throw new FriendshipError("friendship_not_found");
  const row = rows[0];
  if (row.addresseeId !== responderId) throw new FriendshipError("not_addressee");
  if (row.status !== "pending") throw new FriendshipError("not_pending");

  const newStatus: FriendshipStatus = action === "accept" ? "accepted" : "declined";
  const now = new Date().toISOString();
  await drz
    .update(friendships)
    .set({ status: newStatus, respondedAt: now })
    .where(eq(friendships.id, friendshipId));

  return { friendshipId, status: newStatus };
}

/**
 * List accepted friends for the given user. Symmetric: friends are users
 * connected via an `accepted` row in EITHER direction.
 */
export async function listFriends(
  drz: DB,
  userId: number,
): Promise<FriendListEntry[]> {
  // Two halves: (a) rows where I am the requester → friend is the addressee,
  // (b) rows where I am the addressee → friend is the requester. UNION ALL
  // is safe because the unique pair index forbids the same pair appearing
  // twice with status=accepted.
  const rows = await drz.all<{
    friendship_id: number;
    user_id: number;
    display_name: string;
    avatar_url: string | null;
    xp_total: number;
    streak_days: number;
    responded_at: string | null;
  }>(sql`
    SELECT f.id AS friendship_id,
           u.id AS user_id,
           u.display_name,
           u.avatar_url,
           u.xp_total,
           u.streak_days,
           f.responded_at
    FROM friendships f
    JOIN users u ON u.id = f.addressee_id
    WHERE f.status = 'accepted' AND f.requester_id = ${userId}
    UNION ALL
    SELECT f.id AS friendship_id,
           u.id AS user_id,
           u.display_name,
           u.avatar_url,
           u.xp_total,
           u.streak_days,
           f.responded_at
    FROM friendships f
    JOIN users u ON u.id = f.requester_id
    WHERE f.status = 'accepted' AND f.addressee_id = ${userId}
    ORDER BY display_name ASC
  `);

  return (rows as unknown as Array<{
    friendship_id: number;
    user_id: number;
    display_name: string;
    avatar_url: string | null;
    xp_total: number;
    streak_days: number;
    responded_at: string | null;
  }>).map((r) => ({
    friendshipId: r.friendship_id,
    userId: r.user_id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    xpTotal: r.xp_total,
    streakDays: r.streak_days,
    since: r.responded_at ?? "",
  }));
}

/**
 * Incoming pending requests for the given user (rows where I am the
 * addressee). Outgoing requests are deliberately NOT returned by this
 * endpoint; surface them via a future `outgoing` endpoint if a UI need
 * arises.
 */
export async function listPendingRequests(
  drz: DB,
  userId: number,
): Promise<PendingRequestEntry[]> {
  const rows = await drz
    .select({
      friendshipId: friendships.id,
      requesterId: friendships.requesterId,
      createdAt: friendships.createdAt,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.requesterId))
    .where(and(eq(friendships.addresseeId, userId), eq(friendships.status, "pending")))
    .orderBy(sql`${friendships.createdAt} DESC`);
  return rows.map((r) => ({
    friendshipId: r.friendshipId,
    requesterId: r.requesterId,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    createdAt: r.createdAt,
  }));
}
