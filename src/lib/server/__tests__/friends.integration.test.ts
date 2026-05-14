/**
 * Integration tests for the friends-graph server helpers.
 *
 * Runs against the in-memory better-sqlite3 D1 harness (`test-db.ts`) so
 * the real Drizzle schema, migrations, indexes, and FKs all participate.
 *
 * Covers acceptance criteria from issue #57:
 *   - request → pending row created
 *   - accept → status flips, list shows the friend, pending drops the row
 *   - decline → status flips, list still empty
 *   - list → symmetric (works regardless of requester direction)
 *   - self-friend rejected
 *   - duplicate pending request is idempotent
 *   - duplicate request after accept returns "already_friends" (409 in HTTP)
 *   - username lookup is case-insensitive
 *   - only addressee can respond
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  FriendshipError,
  findUserByDisplayName,
  getUserIdByClerkId,
  listFriends,
  listPendingRequests,
  requestFriendship,
  respondToFriendship,
} from "../friends";
import type { TestDb } from "./test-db";
import { makeTestDb, asD1 } from "./test-db";
import { eq } from "drizzle-orm";
import { friendships } from "../../../db/schema";

function seedNamedUser(drz: TestDb, displayName: string, clerkId?: string): number {
  const result = drz.$sqlite
    .prepare(
      `INSERT INTO users (clerk_id, email, display_name) VALUES (?, ?, ?)`,
    )
    .run(
      clerkId ?? `clerk_${displayName.toLowerCase()}_${Math.random().toString(36).slice(2, 6)}`,
      `${displayName.toLowerCase()}@example.test`,
      displayName,
    );
  return Number(result.lastInsertRowid);
}

describe("friends graph (integration: in-memory D1)", () => {
  let drz: TestDb;

  beforeEach(() => {
    drz = makeTestDb();
  });

  describe("findUserByDisplayName", () => {
    it("is case-insensitive", async () => {
      const id = seedNamedUser(drz, "Mehmet");
      const found = await findUserByDisplayName(asD1(drz), "mehmet");
      expect(found?.id).toBe(id);
      const upper = await findUserByDisplayName(asD1(drz), "MEHMET");
      expect(upper?.id).toBe(id);
    });

    it("returns null for an unknown name", async () => {
      seedNamedUser(drz, "Ronan");
      const found = await findUserByDisplayName(asD1(drz), "Nobody");
      expect(found).toBeNull();
    });
  });

  describe("requestFriendship", () => {
    it("creates a pending row on a first request", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      const mehmet = seedNamedUser(drz, "Mehmet");

      const result = await requestFriendship(asD1(drz), ronan, "Mehmet");
      expect(result.status).toBe("pending");
      expect(result.createdFresh).toBe(true);
      expect(result.friendshipId).toBeGreaterThan(0);

      const rows = await drz
        .select()
        .from(friendships)
        .where(eq(friendships.id, result.friendshipId));
      expect(rows).toHaveLength(1);
      expect(rows[0].requesterId).toBe(ronan);
      expect(rows[0].addresseeId).toBe(mehmet);
      expect(rows[0].status).toBe("pending");
    });

    it("looks up the addressee case-insensitively", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      const mehmet = seedNamedUser(drz, "Mehmet");

      const result = await requestFriendship(asD1(drz), ronan, "MEHMET");
      expect(result.createdFresh).toBe(true);
      const rows = await drz
        .select()
        .from(friendships)
        .where(eq(friendships.id, result.friendshipId));
      expect(rows[0].addresseeId).toBe(mehmet);
    });

    it("rejects self-friend", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      await expect(requestFriendship(asD1(drz), ronan, "Ronan")).rejects.toBeInstanceOf(
        FriendshipError,
      );
      await expect(requestFriendship(asD1(drz), ronan, "Ronan")).rejects.toMatchObject({
        code: "self_friend",
      });
    });

    it("rejects unknown addressee", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      await expect(
        requestFriendship(asD1(drz), ronan, "DoesNotExist"),
      ).rejects.toMatchObject({ code: "user_not_found" });
    });

    it("is idempotent: a second request returns the same row, status pending", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      seedNamedUser(drz, "Mehmet");

      const first = await requestFriendship(asD1(drz), ronan, "Mehmet");
      const second = await requestFriendship(asD1(drz), ronan, "Mehmet");
      expect(second.friendshipId).toBe(first.friendshipId);
      expect(second.status).toBe("pending");
      expect(second.createdFresh).toBe(false);

      // No duplicate row.
      const all = await drz.select().from(friendships);
      expect(all).toHaveLength(1);
    });

    it("is idempotent across direction: B requesting A returns A's pending row", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      const mehmet = seedNamedUser(drz, "Mehmet");

      const a = await requestFriendship(asD1(drz), ronan, "Mehmet");
      const b = await requestFriendship(asD1(drz), mehmet, "Ronan");
      expect(b.friendshipId).toBe(a.friendshipId);
      expect(b.createdFresh).toBe(false);
    });

    it("throws 'already_friends' when the pair is already accepted", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      const mehmet = seedNamedUser(drz, "Mehmet");

      const req = await requestFriendship(asD1(drz), ronan, "Mehmet");
      await respondToFriendship(asD1(drz), mehmet, req.friendshipId, "accept");

      await expect(
        requestFriendship(asD1(drz), ronan, "Mehmet"),
      ).rejects.toMatchObject({ code: "already_friends" });
      // And the reverse direction too.
      await expect(
        requestFriendship(asD1(drz), mehmet, "Ronan"),
      ).rejects.toMatchObject({ code: "already_friends" });
    });

    it("allows a fresh request after a previous decline", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      const mehmet = seedNamedUser(drz, "Mehmet");

      const req = await requestFriendship(asD1(drz), ronan, "Mehmet");
      await respondToFriendship(asD1(drz), mehmet, req.friendshipId, "decline");

      const reinvite = await requestFriendship(asD1(drz), ronan, "Mehmet");
      expect(reinvite.createdFresh).toBe(true);
      expect(reinvite.status).toBe("pending");

      // Only the fresh row remains; the declined row was replaced.
      const all = await drz.select().from(friendships);
      expect(all).toHaveLength(1);
      expect(all[0].status).toBe("pending");
      expect(all[0].id).toBe(reinvite.friendshipId);
    });
  });

  describe("respondToFriendship", () => {
    it("accept flips status to accepted and stamps respondedAt", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      const mehmet = seedNamedUser(drz, "Mehmet");
      const req = await requestFriendship(asD1(drz), ronan, "Mehmet");

      const before = Date.now();
      const result = await respondToFriendship(
        asD1(drz),
        mehmet,
        req.friendshipId,
        "accept",
      );
      const after = Date.now();
      expect(result.status).toBe("accepted");

      const rows = await drz
        .select()
        .from(friendships)
        .where(eq(friendships.id, req.friendshipId));
      expect(rows[0].status).toBe("accepted");
      const respondedAt = rows[0].respondedAt;
      expect(respondedAt).not.toBeNull();
      const ts = new Date(respondedAt!).getTime();
      expect(ts).toBeGreaterThanOrEqual(before - 1000);
      expect(ts).toBeLessThanOrEqual(after + 1000);
    });

    it("decline flips status to declined", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      const mehmet = seedNamedUser(drz, "Mehmet");
      const req = await requestFriendship(asD1(drz), ronan, "Mehmet");

      const result = await respondToFriendship(
        asD1(drz),
        mehmet,
        req.friendshipId,
        "decline",
      );
      expect(result.status).toBe("declined");
    });

    it("only the addressee can respond", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      seedNamedUser(drz, "Mehmet");
      const req = await requestFriendship(asD1(drz), ronan, "Mehmet");

      // Requester trying to accept their own request → not_addressee.
      await expect(
        respondToFriendship(asD1(drz), ronan, req.friendshipId, "accept"),
      ).rejects.toMatchObject({ code: "not_addressee" });
    });

    it("404 when the row is missing", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      await expect(
        respondToFriendship(asD1(drz), ronan, 99999, "accept"),
      ).rejects.toMatchObject({ code: "friendship_not_found" });
    });

    it("409-equivalent when the row is no longer pending", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      const mehmet = seedNamedUser(drz, "Mehmet");
      const req = await requestFriendship(asD1(drz), ronan, "Mehmet");
      await respondToFriendship(asD1(drz), mehmet, req.friendshipId, "accept");

      await expect(
        respondToFriendship(asD1(drz), mehmet, req.friendshipId, "decline"),
      ).rejects.toMatchObject({ code: "not_pending" });
    });
  });

  describe("listFriends + listPendingRequests", () => {
    it("after accept: each side sees the other in list, pending is empty for both", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      const mehmet = seedNamedUser(drz, "Mehmet");
      const req = await requestFriendship(asD1(drz), ronan, "Mehmet");
      await respondToFriendship(asD1(drz), mehmet, req.friendshipId, "accept");

      const ronanFriends = await listFriends(asD1(drz), ronan);
      const mehmetFriends = await listFriends(asD1(drz), mehmet);
      expect(ronanFriends.map((f) => f.displayName)).toEqual(["Mehmet"]);
      expect(mehmetFriends.map((f) => f.displayName)).toEqual(["Ronan"]);
      expect(ronanFriends[0].friendshipId).toBe(req.friendshipId);

      const ronanPending = await listPendingRequests(asD1(drz), ronan);
      const mehmetPending = await listPendingRequests(asD1(drz), mehmet);
      expect(ronanPending).toEqual([]);
      expect(mehmetPending).toEqual([]);
    });

    it("after decline: list empty, pending empty", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      const mehmet = seedNamedUser(drz, "Mehmet");
      const req = await requestFriendship(asD1(drz), ronan, "Mehmet");
      await respondToFriendship(asD1(drz), mehmet, req.friendshipId, "decline");

      expect(await listFriends(asD1(drz), ronan)).toEqual([]);
      expect(await listFriends(asD1(drz), mehmet)).toEqual([]);
      expect(await listPendingRequests(asD1(drz), ronan)).toEqual([]);
      expect(await listPendingRequests(asD1(drz), mehmet)).toEqual([]);
    });

    it("pending shows incoming-only (addressee), not outgoing", async () => {
      const ronan = seedNamedUser(drz, "Ronan");
      const mehmet = seedNamedUser(drz, "Mehmet");
      await requestFriendship(asD1(drz), ronan, "Mehmet");

      const ronanPending = await listPendingRequests(asD1(drz), ronan);
      const mehmetPending = await listPendingRequests(asD1(drz), mehmet);
      expect(ronanPending).toEqual([]);
      expect(mehmetPending).toHaveLength(1);
      expect(mehmetPending[0].displayName).toBe("Ronan");
      expect(mehmetPending[0].requesterId).toBe(ronan);
    });

    it("list is sorted by display name and includes multiple friends from both directions", async () => {
      const me = seedNamedUser(drz, "Me");
      seedNamedUser(drz, "Alice");
      seedNamedUser(drz, "Bob");
      seedNamedUser(drz, "Charlie");

      // Me invites Alice and Charlie; Bob invites Me.
      const r1 = await requestFriendship(asD1(drz), me, "Alice");
      const r2 = await requestFriendship(asD1(drz), me, "Charlie");
      const r3 = await requestFriendship(
        asD1(drz),
        (await findUserByDisplayName(asD1(drz), "Bob"))!.id,
        "Me",
      );

      // Resolve everyone's id once; accept each.
      const aliceId = (await findUserByDisplayName(asD1(drz), "Alice"))!.id;
      const charlieId = (await findUserByDisplayName(asD1(drz), "Charlie"))!.id;
      await respondToFriendship(asD1(drz), aliceId, r1.friendshipId, "accept");
      await respondToFriendship(asD1(drz), charlieId, r2.friendshipId, "accept");
      await respondToFriendship(asD1(drz), me, r3.friendshipId, "accept");

      const friends = await listFriends(asD1(drz), me);
      expect(friends.map((f) => f.displayName)).toEqual(["Alice", "Bob", "Charlie"]);
    });
  });

  describe("getUserIdByClerkId", () => {
    it("resolves clerk_id → numeric id", async () => {
      const id = seedNamedUser(drz, "Ronan", "clerk_ronan_abc");
      const resolved = await getUserIdByClerkId(asD1(drz), "clerk_ronan_abc");
      expect(resolved).toBe(id);
    });

    it("returns null for an unknown clerk-id", async () => {
      seedNamedUser(drz, "Ronan", "clerk_ronan_abc");
      const resolved = await getUserIdByClerkId(asD1(drz), "clerk_missing");
      expect(resolved).toBeNull();
    });
  });
});
