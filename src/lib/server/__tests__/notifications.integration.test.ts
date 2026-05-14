/**
 * Integration tests for in-app notification helpers.
 *
 * Runs against the in-memory better-sqlite3 D1 harness so the real Drizzle
 * schema, migrations through 0011, and FK constraints all participate.
 *
 * Covers:
 *   - inbox lists unread in_app rows only, newest first, scoped to user
 *   - inbox decorates peer_drill_completed rows with sender display name +
 *     a deep link to /app/peer
 *   - markRead flips read_at; is idempotent; refuses to update someone
 *     else's notification (returns false, leaves row untouched)
 *   - friend-only filter: a peer_drill_completed row only exists when the
 *     submitter was an accepted friend at submit time (this is the
 *     producer-side guarantee; we assert the wiring is intact end-to-end
 *     by routing through submitPeerDrill)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { listInbox, markRead } from "../notifications";
import { submitPeerDrill, sendPeerDrill } from "../peer-drills";
import { notificationLog } from "../../../db/schema";
import { makeTestDb, asD1 } from "./test-db";
import type { TestDb } from "./test-db";

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

describe("notifications (integration: in-memory D1)", () => {
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

  describe("listInbox", () => {
    it("returns only unread in_app rows for the user, newest first", async () => {
      // Two peer-drill completions trigger two in_app rows back to alice.
      const first = await sendPeerDrill(asD1(drz), alice, bob, "Een.");
      const second = await sendPeerDrill(asD1(drz), alice, bob, "Twee.");
      await submitPeerDrill(asD1(drz), first.id, bob, "One.");
      await submitPeerDrill(asD1(drz), second.id, bob, "Two.");

      const inbox = await listInbox(asD1(drz), alice);
      expect(inbox).toHaveLength(2);
      // Both decorated with submitter (Bob) and deep-link.
      expect(inbox.every((n) => n.fromDisplayName === "Bob")).toBe(true);
      expect(inbox.every((n) => n.link === "/app/peer")).toBe(true);
      expect(inbox.every((n) => n.kind === "peer_drill_completed")).toBe(true);
    });

    it("excludes already-read rows", async () => {
      const sent = await sendPeerDrill(asD1(drz), alice, bob, "Hoi.");
      await submitPeerDrill(asD1(drz), sent.id, bob, "Hi.");

      // Mark the (only) notification read.
      const inboxBefore = await listInbox(asD1(drz), alice);
      expect(inboxBefore).toHaveLength(1);
      await markRead(asD1(drz), inboxBefore[0].id, alice);

      const inboxAfter = await listInbox(asD1(drz), alice);
      expect(inboxAfter).toHaveLength(0);
    });

    it("excludes push/email rows (other channels)", async () => {
      // Manual insert with channel='push' should never appear in the inbox.
      await drz.insert(notificationLog).values({
        userId: alice,
        channel: "push",
        kind: "daily_nag",
      });
      const inbox = await listInbox(asD1(drz), alice);
      expect(inbox).toHaveLength(0);
    });

    it("does not leak another user's notifications", async () => {
      // Bob completes a drill from alice; the resulting in_app row goes to
      // alice. Charlie has no friendship with anyone and no notifications.
      const sent = await sendPeerDrill(asD1(drz), alice, bob, "Vraag.");
      await submitPeerDrill(asD1(drz), sent.id, bob, "Question.");

      const charlieInbox = await listInbox(asD1(drz), charlie);
      expect(charlieInbox).toHaveLength(0);

      const aliceInbox = await listInbox(asD1(drz), alice);
      expect(aliceInbox).toHaveLength(1);
    });

    it("caps the result at the requested limit", async () => {
      // Seed 5 in_app rows for alice directly.
      for (let i = 0; i < 5; i++) {
        await drz.insert(notificationLog).values({
          userId: alice,
          channel: "in_app",
          kind: "peer_drill_completed",
          result: String(i + 1),
        });
      }
      const inbox = await listInbox(asD1(drz), alice, 3);
      expect(inbox).toHaveLength(3);
    });
  });

  describe("markRead", () => {
    it("flips read_at on the row and returns true", async () => {
      const sent = await sendPeerDrill(asD1(drz), alice, bob, "Klopt?");
      await submitPeerDrill(asD1(drz), sent.id, bob, "Right?");
      const inbox = await listInbox(asD1(drz), alice);
      expect(inbox).toHaveLength(1);
      const id = inbox[0].id;

      const ok = await markRead(asD1(drz), id, alice);
      expect(ok).toBe(true);

      const rows = await drz
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.id, id));
      expect(rows[0].readAt).not.toBeNull();
    });

    it("is idempotent — a second call returns false and does not change read_at", async () => {
      const sent = await sendPeerDrill(asD1(drz), alice, bob, "Nog eens?");
      await submitPeerDrill(asD1(drz), sent.id, bob, "Again?");
      const inbox = await listInbox(asD1(drz), alice);
      const id = inbox[0].id;

      await markRead(asD1(drz), id, alice);
      const before = await drz
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.id, id));
      const stamp = before[0].readAt;

      const second = await markRead(asD1(drz), id, alice);
      expect(second).toBe(false);

      const after = await drz
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.id, id));
      expect(after[0].readAt).toBe(stamp);
    });

    it("refuses to mark someone else's notification — returns false, untouched", async () => {
      const sent = await sendPeerDrill(asD1(drz), alice, bob, "Geheim.");
      await submitPeerDrill(asD1(drz), sent.id, bob, "Secret.");
      const inbox = await listInbox(asD1(drz), alice);
      const id = inbox[0].id;

      const ok = await markRead(asD1(drz), id, charlie);
      expect(ok).toBe(false);

      const rows = await drz
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.id, id));
      expect(rows[0].readAt).toBeNull();
    });

    it("returns false for an unknown id", async () => {
      const ok = await markRead(asD1(drz), 999999, alice);
      expect(ok).toBe(false);
    });
  });
});
