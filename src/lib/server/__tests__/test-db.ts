/**
 * Test-DB helper for integration tests.
 *
 * Spins up a fresh in-memory SQLite database (via better-sqlite3) and applies
 * the same `drizzle/*.sql` migration files we ship to D1, so server functions
 * that take a `DrizzleD1Database` can be exercised against a local SQLite
 * binding with identical schema.
 *
 * Drizzle's D1 and better-sqlite3 drivers share the SQLite dialect and the
 * same query-builder API surface, so a cast to DrizzleD1Database is safe at
 * runtime for the helpers under test (they only use select/insert/update/
 * delete + `sql` template literals, none of which differ between drivers).
 */
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as schema from "../../../db/schema";

export type TestDb = BetterSQLite3Database<typeof schema> & {
  $sqlite: Database.Database;
};

/**
 * Create a fresh in-memory DB, apply all `drizzle/*.sql` migrations, and
 * return the Drizzle handle (with the raw better-sqlite3 instance attached
 * as `$sqlite` for low-level introspection in tests).
 */
export function makeTestDb(): TestDb {
  const sqlite = new Database(":memory:");
  // Use the same pragmas D1 uses on the read side; this mostly avoids
  // surprising NULL-vs-empty behaviour.
  sqlite.pragma("journal_mode = MEMORY");
  sqlite.pragma("foreign_keys = ON");

  const migrationsDir = resolve(__dirname, "../../../../drizzle");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    if (!sql.trim()) continue;
    // Drizzle splits statements with this sentinel; better-sqlite3 can also
    // exec the whole blob at once because it uses `sqlite3_exec`, but
    // splitting gives us cleaner error messages if one statement is bad.
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      sqlite.exec(stmt);
    }
  }

  const drz = drizzle(sqlite, { schema }) as TestDb;
  drz.$sqlite = sqlite;
  return drz;
}

/**
 * Helper: cast our better-sqlite3 Drizzle handle to the D1 shape that the
 * production server fns expect. Safe at runtime because both drivers expose
 * the same Drizzle query-builder surface for the operations under test.
 */
export function asD1(drz: TestDb): DrizzleD1Database {
  return drz as unknown as DrizzleD1Database;
}

/**
 * Insert a minimal user row and return its id. Tests can then drive the
 * gamification helpers against this user.
 */
export function seedUser(
  drz: TestDb,
  overrides: Partial<{
    clerkId: string;
    email: string;
    displayName: string;
    streakDays: number;
    streakFreezesBalance: number;
    streakLastActiveDate: string | null;
  }> = {},
): number {
  const clerkId = overrides.clerkId ?? `clerk_${Math.random().toString(36).slice(2)}`;
  const displayName = overrides.displayName ?? `user_${Math.random().toString(36).slice(2, 8)}`;
  const result = drz.$sqlite
    .prepare(
      `INSERT INTO users (clerk_id, email, display_name, streak_days, streak_freezes_balance, streak_last_active_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      clerkId,
      overrides.email ?? null,
      displayName,
      overrides.streakDays ?? 0,
      overrides.streakFreezesBalance ?? 0,
      overrides.streakLastActiveDate ?? null,
    );
  return Number(result.lastInsertRowid);
}
