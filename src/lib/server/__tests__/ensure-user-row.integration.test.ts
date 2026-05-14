/**
 * Integration tests for `ensureUserRow()` (issue #113).
 *
 * Exercises the lazy-upsert helper against the in-memory better-sqlite3 D1
 * harness so the real schema (UNIQUE on `users.clerk_id` and
 * `users.display_name`) participates. The Clerk Backend SDK is not actually
 * called: we inject a `fetchClerkUser` stub via the helper's options to keep
 * the test offline and deterministic.
 *
 * Coverage:
 *   - row created when missing, with values pulled from the Clerk stub
 *   - row returned as-is when it already exists (no Clerk call, no insert)
 *   - display_name UNIQUE collisions resolved by `-2`, `-3`, ... suffixes
 *   - first/last name preferred, then username, then email-local-part,
 *     then `user-<last6>` fallback
 */
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { ensureUserRow } from "../ensure-user-row";
import type { ClerkUserLike, FetchClerkUser } from "../ensure-user-row";
import { users } from "../../../db/schema";
import { makeTestDb, asD1 } from "./test-db";
import type { TestDb } from "./test-db";
import type { WorkerEnv } from "../worker-context";

const fakeEnv = { CLERK_SECRET_KEY: "sk_test_unused" } as unknown as WorkerEnv;

function makeFetcher(user: ClerkUserLike): { fn: FetchClerkUser; getCalls: () => number } {
  let n = 0;
  const fn: FetchClerkUser = async (clerkId) => {
    n += 1;
    return { ...user, id: clerkId };
  };
  return { fn, getCalls: () => n };
}

describe("ensureUserRow", () => {
  let drz: TestDb;

  beforeEach(() => {
    drz = makeTestDb();
  });

  it("inserts a new row when the clerk id is unknown", async () => {
    const { fn: fetchClerkUser, getCalls } = makeFetcher({
      id: "ignored",
      firstName: "Alice",
      lastName: "Smith",
      username: "alice",
      imageUrl: "https://img.test/a.png",
      emailAddresses: [{ emailAddress: "alice@example.test" }],
    });

    const row = await ensureUserRow("user_alice_001", asD1(drz), fakeEnv, { fetchClerkUser });

    expect(row.clerkId).toBe("user_alice_001");
    expect(row.email).toBe("alice@example.test");
    expect(row.displayName).toBe("Alice Smith");
    expect(row.avatarUrl).toBe("https://img.test/a.png");
    expect(row.cefrLevel).toBe("A2");
    expect(getCalls()).toBe(1);

    // Persisted, not just returned.
    const persisted = await asD1(drz)
      .select()
      .from(users)
      .where(eq(users.clerkId, "user_alice_001"))
      .limit(1);
    expect(persisted[0]?.displayName).toBe("Alice Smith");
  });

  it("returns the existing row without calling Clerk when the id is known", async () => {
    drz.$sqlite
      .prepare(
        `INSERT INTO users (clerk_id, email, display_name, cefr_level)
         VALUES (?, ?, ?, ?)`,
      )
      .run("user_existing", "existing@example.test", "Existing User", "B1");

    const { fn: fetchClerkUser, getCalls } = makeFetcher({
      id: "should-not-be-used",
      firstName: "Should",
      lastName: "NotFire",
      username: null,
      imageUrl: null,
      emailAddresses: [],
    });

    const row = await ensureUserRow("user_existing", asD1(drz), fakeEnv, { fetchClerkUser });

    expect(row.displayName).toBe("Existing User");
    expect(row.cefrLevel).toBe("B1");
    expect(getCalls()).toBe(0);
  });

  it("dedups display_name on collision by suffixing -2, -3, ...", async () => {
    // Seed two rows that already occupy `Ronan` and `Ronan-2`.
    drz.$sqlite
      .prepare(
        `INSERT INTO users (clerk_id, display_name) VALUES (?, ?), (?, ?)`,
      )
      .run("seed_ronan", "Ronan", "seed_ronan_b", "Ronan-2");

    // Each upsert gets a fresh email so the only collision under test is the
    // display_name UNIQUE — that is what we want to assert.
    const mk = (email: string): FetchClerkUser => async (clerkId) => ({
      id: clerkId,
      firstName: "Ronan",
      lastName: null,
      username: null,
      imageUrl: null,
      emailAddresses: [{ emailAddress: email }],
    });

    const row = await ensureUserRow("user_ronan_new", asD1(drz), fakeEnv, {
      fetchClerkUser: mk("ronan-new@example.test"),
    });
    expect(row.displayName).toBe("Ronan-3");

    // And one more collision after that resolves to -4.
    const row2 = await ensureUserRow("user_ronan_newer", asD1(drz), fakeEnv, {
      fetchClerkUser: mk("ronan-newer@example.test"),
    });
    expect(row2.displayName).toBe("Ronan-4");
  });

  it("falls back to username when first/last name are empty", async () => {
    const { fn: fetchClerkUser } = makeFetcher({
      id: "ignored",
      firstName: null,
      lastName: null,
      username: "bobby",
      imageUrl: null,
      emailAddresses: [{ emailAddress: "bobby@example.test" }],
    });
    const row = await ensureUserRow("user_bobby", asD1(drz), fakeEnv, { fetchClerkUser });
    expect(row.displayName).toBe("bobby");
  });

  it("falls back to email-local-part when name + username are empty", async () => {
    const { fn: fetchClerkUser } = makeFetcher({
      id: "ignored",
      firstName: null,
      lastName: null,
      username: null,
      imageUrl: null,
      emailAddresses: [{ emailAddress: "carol@example.test" }],
    });
    const row = await ensureUserRow("user_carol", asD1(drz), fakeEnv, { fetchClerkUser });
    expect(row.displayName).toBe("carol");
  });

  it("falls back to user-<last6> when nothing else is available", async () => {
    const { fn: fetchClerkUser } = makeFetcher({
      id: "ignored",
      firstName: null,
      lastName: null,
      username: null,
      imageUrl: null,
      emailAddresses: [],
    });
    const row = await ensureUserRow("user_abcdef123456", asD1(drz), fakeEnv, { fetchClerkUser });
    expect(row.displayName).toBe("user-123456");
  });
});
