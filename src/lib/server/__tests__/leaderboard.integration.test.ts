/**
 * Integration tests for the friends-leaderboard helper.
 *
 * Exercises `getFriendsLeaderboardForUser` against the in-memory D1
 * harness so the real Drizzle schema, FK rules, and migrations all
 * participate. Covers issue #58 acceptance:
 *
 *   - empty rows[] when caller has no accepted friends
 *   - 3 rows when caller has 2 accepted friends (caller + 2)
 *   - ranking by window XP descending; tiebreak by display name
 *   - all-time window uses users.xp_total
 *   - today / week windows sum xp_events since the window start
 *   - `isMe` flag set only on the caller's row
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getFriendsLeaderboardForUser } from "../leaderboard";
import { requestFriendship, respondToFriendship } from "../friends";
import { asD1, makeTestDb } from "./test-db";
import type { TestDb } from "./test-db";

function seedNamedUser(
  drz: TestDb,
  displayName: string,
  opts: { xpTotal?: number; streakDays?: number } = {},
): number {
  const result = drz.$sqlite
    .prepare(
      `INSERT INTO users (clerk_id, email, display_name, xp_total, streak_days)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      `clerk_${displayName.toLowerCase()}_${Math.random().toString(36).slice(2, 6)}`,
      `${displayName.toLowerCase()}@example.test`,
      displayName,
      opts.xpTotal ?? 0,
      opts.streakDays ?? 0,
    );
  return Number(result.lastInsertRowid);
}

function seedXpEvent(
  drz: TestDb,
  userId: number,
  delta: number,
  createdAt: string,
): void {
  drz.$sqlite
    .prepare(
      `INSERT INTO xp_events (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)`,
    )
    .run(userId, delta, "seed", createdAt);
}

async function makeAcceptedFriendship(
  drz: TestDb,
  fromUserId: number,
  toDisplayName: string,
): Promise<void> {
  const req = await requestFriendship(asD1(drz), fromUserId, toDisplayName);
  // Resolve the addressee's id by looking up the row we just created.
  const rows = drz.$sqlite
    .prepare(`SELECT addressee_id FROM friendships WHERE id = ?`)
    .get(req.friendshipId) as { addressee_id: number } | undefined;
  if (!rows) throw new Error("friendship row missing after request");
  await respondToFriendship(asD1(drz), rows.addressee_id, req.friendshipId, "accept");
}

describe("friends leaderboard (integration: in-memory D1)", () => {
  let drz: TestDb;

  beforeEach(() => {
    drz = makeTestDb();
  });

  it("returns empty rows when the caller has no accepted friends", async () => {
    const me = seedNamedUser(drz, "Ronan", { xpTotal: 500 });

    const result = await getFriendsLeaderboardForUser(asD1(drz), me, "week");
    expect(result.rows).toEqual([]);
    expect(result.window).toBe("week");
  });

  it("returns 3 rows (caller + 2 friends) when the caller has 2 accepted friends", async () => {
    const me = seedNamedUser(drz, "Ronan", { xpTotal: 1200 });
    seedNamedUser(drz, "Mehmet", { xpTotal: 800 });
    seedNamedUser(drz, "Alice", { xpTotal: 2500 });

    await makeAcceptedFriendship(drz, me, "Mehmet");
    await makeAcceptedFriendship(drz, me, "Alice");

    const result = await getFriendsLeaderboardForUser(asD1(drz), me, "all-time");
    expect(result.rows).toHaveLength(3);
    // Ranked by xpTotal desc on all-time: Alice (2500), Ronan (1200), Mehmet (800).
    expect(result.rows.map((r) => r.displayName)).toEqual(["Alice", "Ronan", "Mehmet"]);
    expect(result.rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    // isMe only on the caller row.
    expect(result.rows.find((r) => r.displayName === "Ronan")?.isMe).toBe(true);
    expect(result.rows.find((r) => r.displayName === "Alice")?.isMe).toBe(false);
    expect(result.rows.find((r) => r.displayName === "Mehmet")?.isMe).toBe(false);
  });

  it("breaks ties by display name ascending", async () => {
    const me = seedNamedUser(drz, "Mike", { xpTotal: 1000 });
    seedNamedUser(drz, "Alice", { xpTotal: 1000 });
    seedNamedUser(drz, "Zara", { xpTotal: 1000 });

    await makeAcceptedFriendship(drz, me, "Alice");
    await makeAcceptedFriendship(drz, me, "Zara");

    const result = await getFriendsLeaderboardForUser(asD1(drz), me, "all-time");
    expect(result.rows.map((r) => r.displayName)).toEqual(["Alice", "Mike", "Zara"]);
  });

  it("for week window: ranks by xp_events summed since UTC Monday", async () => {
    const me = seedNamedUser(drz, "Ronan", { xpTotal: 9999 });
    seedNamedUser(drz, "Mehmet", { xpTotal: 9999 });
    await makeAcceptedFriendship(drz, me, "Mehmet");

    // Compute "this week" Monday in UTC.
    const monday = new Date();
    monday.setUTCHours(0, 0, 0, 0);
    const dow = monday.getUTCDay();
    monday.setUTCDate(monday.getUTCDate() - ((dow + 6) % 7));
    const fiveMinAfterMonday = new Date(monday.getTime() + 5 * 60_000).toISOString();
    const lastWeek = new Date(monday.getTime() - 7 * 24 * 60 * 60_000).toISOString();

    // Ronan earned 100 XP this week + 9999 last week (which should NOT count).
    seedXpEvent(drz, me, 100, fiveMinAfterMonday);
    seedXpEvent(drz, me, 9999, lastWeek);

    // Mehmet earned 50 XP this week.
    const mehmetId = drz.$sqlite
      .prepare(`SELECT id FROM users WHERE display_name = ?`)
      .get("Mehmet") as { id: number };
    seedXpEvent(drz, mehmetId.id, 50, fiveMinAfterMonday);

    const result = await getFriendsLeaderboardForUser(asD1(drz), me, "week");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].displayName).toBe("Ronan");
    expect(result.rows[0].windowXp).toBe(100);
    expect(result.rows[1].displayName).toBe("Mehmet");
    expect(result.rows[1].windowXp).toBe(50);
  });

  it("ignores negative xp_events (correctness vs penalty events)", async () => {
    const me = seedNamedUser(drz, "Ronan", { xpTotal: 100 });
    seedNamedUser(drz, "Mehmet", { xpTotal: 100 });
    await makeAcceptedFriendship(drz, me, "Mehmet");

    const today = new Date();
    today.setUTCHours(1, 0, 0, 0);
    const iso = today.toISOString();
    seedXpEvent(drz, me, 50, iso);
    seedXpEvent(drz, me, -1000, iso); // ignored — leaderboard.ts filters delta > 0
    const mehmetId = drz.$sqlite
      .prepare(`SELECT id FROM users WHERE display_name = ?`)
      .get("Mehmet") as { id: number };
    seedXpEvent(drz, mehmetId.id, 25, iso);

    const result = await getFriendsLeaderboardForUser(asD1(drz), me, "today");
    expect(result.rows[0].displayName).toBe("Ronan");
    expect(result.rows[0].windowXp).toBe(50);
    expect(result.rows[1].windowXp).toBe(25);
  });
});
