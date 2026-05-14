/**
 * Integration tests for peer-drill server helpers.
 *
 * Runs against the in-memory better-sqlite3 D1 harness so the real Drizzle
 * schema, the 0006 migration, and FK constraints all participate.
 *
 * Covers acceptance criteria from issue #59:
 *   - send → row created, status=pending
 *   - inbox → lists pending rows for the recipient
 *   - submit → flips status, stamps completed_at, records in-app notification
 *   - non-friend rejection (both send-side and submit-side defensive guard)
 *   - self-send rejected
 *   - empty prompt / answer rejected
 */
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  PeerDrillError,
  listInbox,
  sendPeerDrill,
  submitPeerDrill,
} from "../peer-drills";
import { friendships, notificationLog, peerDrills } from "../../../db/schema";
import { makeTestDb, asD1, type TestDb } from "./test-db";

function seedNamedUser(drz: TestDb, displayName: string): number {
  const result = drz.$sqlite
    .prepare(`INSERT INTO users (clerk_id, email, display_name) VALUES (?, ?, ?)`)
    .run(
      `clerk_${displayName.toLowerCase()}_${Math.random().toString(36).slice(2, 6)}`,
      `${displayName.toLowerCase()}@example.test`,
      displayName,
    );
  return Number(result.lastInsertRowid);
}

function seedAcceptedFriendship(drz: TestDb, requesterId: number, addresseeId: number) {
  drz.$sqlite
    .prepare(
      `INSERT INTO friendships (requester_id, addressee_id, status, responded_at)
       VALUES (?, ?, 'accepted', CURRENT_TIMESTAMP)`,
    )
    .run(requesterId, addresseeId);
}

describe("peer drills (integration: in-memory D1)", () => {
  let drz: TestDb;
  let alice: number;
  let bob: number;
  let charlie: number;

  beforeEach(() => {
    drz = makeTestDb();
    alice = seedNamedUser(drz, "Alice");
    bob = seedNamedUser(drz, "Bob");
    charlie = seedNamedUser(drz, "Charlie");
    seedAcceptedFriendship(drz, alice, bob);
  });

  describe("sendPeerDrill", () => {
    it("creates a pending row when sender + recipient are friends", async () => {
      const result = await sendPeerDrill(
        asD1(drz),
        alice,
        bob,
        "Ik ga morgen naar de markt.",
        "future tense",
      );
      expect(result.id).toBeGreaterThan(0);

      const rows = await drz
        .select()
        .from(peerDrills)
        .where(eq(peerDrills.id, result.id));
      expect(rows[0].fromUserId).toBe(alice);
      expect(rows[0].toUserId).toBe(bob);
      expect(rows[0].status).toBe("pending");
      expect(rows[0].prompt).toBe("Ik ga morgen naar de markt.");
      expect(rows[0].expectedAnswerHint).toBe("future tense");
      expect(rows[0].completedAt).toBeNull();
    });

    it("rejects non-friends with not_friends", async () => {
      await expect(
        sendPeerDrill(asD1(drz), alice, charlie, "Hallo!"),
      ).rejects.toBeInstanceOf(PeerDrillError);
      await expect(sendPeerDrill(asD1(drz), alice, charlie, "Hallo!")).rejects.toMatchObject({
        code: "not_friends",
      });

      const rows = await drz.select().from(peerDrills);
      expect(rows).toHaveLength(0);
    });

    it("rejects self-send", async () => {
      await expect(sendPeerDrill(asD1(drz), alice, alice, "Hi me")).rejects.toMatchObject({
        code: "self_drill",
      });
    });

    it("rejects empty prompt", async () => {
      await expect(sendPeerDrill(asD1(drz), alice, bob, "   ")).rejects.toMatchObject({
        code: "empty_prompt",
      });
    });

    it("rejects unknown recipient with user_not_found", async () => {
      await expect(sendPeerDrill(asD1(drz), alice, 99999, "Hi")).rejects.toMatchObject({
        code: "user_not_found",
      });
    });
  });

  describe("listInbox", () => {
    it("returns only pending rows for the given recipient, newest first", async () => {
      const first = await sendPeerDrill(asD1(drz), alice, bob, "Eerste zin.");
      const second = await sendPeerDrill(asD1(drz), alice, bob, "Tweede zin.");
      // Charlie -> bob would need a friendship; skip. Bob's inbox should not
      // include drills addressed to alice.
      seedAcceptedFriendship(drz, bob, charlie);
      await sendPeerDrill(asD1(drz), bob, charlie, "Aan charlie.");

      const inbox = await listInbox(asD1(drz), bob);
      // Both pending rows addressed to bob, regardless of tie-break order.
      // (CURRENT_TIMESTAMP defaults to second precision so the two inserts
      // can share a stamp.)
      expect(inbox.map((r) => r.id).sort()).toEqual(
        [first.id, second.id].sort(),
      );
      expect(inbox.every((r) => r.fromDisplayName === "Alice")).toBe(true);
      expect(inbox.map((r) => r.prompt).sort()).toEqual(
        ["Eerste zin.", "Tweede zin."].sort(),
      );
    });

    it("excludes completed drills from the inbox", async () => {
      const sent = await sendPeerDrill(asD1(drz), alice, bob, "Eerste zin.");
      await submitPeerDrill(asD1(drz), sent.id, bob, "First sentence.");

      const inbox = await listInbox(asD1(drz), bob);
      expect(inbox).toHaveLength(0);
    });
  });

  describe("submitPeerDrill", () => {
    it("flips status, stamps completed_at, records in-app notification", async () => {
      const sent = await sendPeerDrill(asD1(drz), alice, bob, "Hoe gaat het?");
      const result = await submitPeerDrill(asD1(drz), sent.id, bob, "How are you?");
      expect(result.id).toBe(sent.id);
      expect(result.fromUserId).toBe(alice);

      const rows = await drz
        .select()
        .from(peerDrills)
        .where(eq(peerDrills.id, sent.id));
      expect(rows[0].status).toBe("completed");
      expect(rows[0].answer).toBe("How are you?");
      expect(rows[0].completedAt).not.toBeNull();

      const notifs = await drz
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.userId, alice));
      expect(notifs).toHaveLength(1);
      expect(notifs[0].channel).toBe("in_app");
      expect(notifs[0].kind).toBe("peer_drill_completed");
      expect(notifs[0].result).toBe(String(sent.id));
    });

    it("rejects when caller is not the recipient", async () => {
      const sent = await sendPeerDrill(asD1(drz), alice, bob, "Ik weet het niet.");
      await expect(
        submitPeerDrill(asD1(drz), sent.id, charlie, "I don't know."),
      ).rejects.toMatchObject({ code: "not_recipient" });
    });

    it("rejects when the drill no longer exists", async () => {
      await expect(
        submitPeerDrill(asD1(drz), 99999, bob, "anything"),
      ).rejects.toMatchObject({ code: "drill_not_found" });
    });

    it("rejects double-submit with not_pending", async () => {
      const sent = await sendPeerDrill(asD1(drz), alice, bob, "Tot morgen!");
      await submitPeerDrill(asD1(drz), sent.id, bob, "See you tomorrow!");
      await expect(
        submitPeerDrill(asD1(drz), sent.id, bob, "Different answer"),
      ).rejects.toMatchObject({ code: "not_pending" });
    });

    it("rejects empty answer", async () => {
      const sent = await sendPeerDrill(asD1(drz), alice, bob, "Wat is dit?");
      await expect(
        submitPeerDrill(asD1(drz), sent.id, bob, "   "),
      ).rejects.toMatchObject({ code: "empty_answer" });
    });

    it("rejects when friendship was revoked between send and submit", async () => {
      const sent = await sendPeerDrill(asD1(drz), alice, bob, "Klopt dat?");
      // Defensive guard: nuke the friendship row, then attempt submit.
      await drz
        .delete(friendships)
        .where(eq(friendships.requesterId, alice));
      await expect(
        submitPeerDrill(asD1(drz), sent.id, bob, "Is that right?"),
      ).rejects.toMatchObject({ code: "not_friends" });
    });
  });
});
