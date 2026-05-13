#!/usr/bin/env tsx
/**
 * Seed demo users for the leaderboard (US-035).
 *
 * Reads seed/users.json and emits idempotent SQL that:
 *   - inserts 4 user rows (INSERT OR IGNORE keyed on clerk_id placeholder)
 *   - backdates streak_last_active_date to today
 *   - inserts user_unit_progress rows for each completed unit + current unit
 *   - generates simulated xp_events spaced across the user's days-active
 *     window so the leaderboard "Today" / "This Week" tabs are non-empty
 *
 * Usage:
 *   pnpm seed:users              # --local by default
 *   pnpm seed:users --remote     # production D1
 *   pnpm seed:users --emit-only  # write SQL, don't execute
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";
import { resolve, join } from "node:path";

const args = process.argv.slice(2);
const REMOTE = args.includes("--remote");
const EMIT_ONLY = args.includes("--emit-only");

const SEED_PATH = resolve("seed/users.json");
const OUT_PATH = resolve("drizzle/seed/seed-users.sql");

type SeedUser = {
  display_name: string;
  email_placeholder: string;
  cefr_level: string;
  streak_days: number;
  xp_total: number;
  coins_balance: number;
  streak_freezes_balance: number;
  hints_balance: number;
  units_completed: string[];
  current_unit: string;
  current_unit_lessons_completed: number;
  current_unit_lessons_total: number;
  days_active: number;
};

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

function clerkIdPlaceholder(displayName: string): string {
  // Stable placeholder so the row is idempotent across runs. Real Clerk IDs
  // will overwrite via the webhook the first time the user signs up.
  return `seed_${displayName.toLowerCase()}`;
}

function todayIso(): string {
  return new Date().toISOString();
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

async function main() {
  const users: SeedUser[] = JSON.parse(await readFile(SEED_PATH, "utf8"));
  const out: string[] = [];

  out.push("-- US-035: demo users for non-empty leaderboard.");
  out.push("-- Idempotent — re-running is safe.");

  for (const u of users) {
    const clerkId = clerkIdPlaceholder(u.display_name);
    out.push(`-- ${u.display_name}`);
    out.push(`INSERT OR IGNORE INTO users
      (clerk_id, email, display_name, cefr_level, streak_days, xp_total,
       coins_balance, streak_freezes_balance, hints_balance, sfx_enabled,
       is_public, streak_last_active_date, onboarded_at)
      VALUES (
        '${clerkId}',
        '${esc(u.email_placeholder)}',
        '${esc(u.display_name)}',
        '${esc(u.cefr_level)}',
        ${u.streak_days},
        ${u.xp_total},
        ${u.coins_balance},
        ${u.streak_freezes_balance},
        ${u.hints_balance},
        1,
        1,
        '${todayIso().slice(0, 10)}',
        '${daysAgoIso(u.days_active)}'
      );`);

    // user_unit_progress for completed + in-progress units. We resolve unit_id
    // by sub-select on slug so the seed survives unit-id churn between
    // environments.
    for (const unitSlug of u.units_completed) {
      out.push(`INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '${daysAgoIso(u.days_active)}', '${daysAgoIso(2)}', '${daysAgoIso(2)}'
        FROM users u, units n
        WHERE u.clerk_id = '${clerkId}' AND n.slug = '${esc(unitSlug)}';`);
    }
    out.push(`INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, updated_at)
      SELECT u.id, n.id, 'in_progress', ${u.current_unit_lessons_completed}, ${u.current_unit_lessons_total}, '${daysAgoIso(3)}', '${todayIso()}'
      FROM users u, units n
      WHERE u.clerk_id = '${clerkId}' AND n.slug = '${esc(u.current_unit)}';`);

    // Simulated xp_events spaced naturally across days_active. We don't want
    // to backfill every single event — just enough that "Today" and "Week"
    // leaderboards show realistic deltas.
    const todayXp = Math.max(20, Math.round(u.xp_total / Math.max(u.days_active, 1)));
    out.push(`INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, ${todayXp}, 'seed', 'seed', 'today', '${todayIso()}'
      FROM users u WHERE u.clerk_id = '${clerkId}';`);
    out.push(`INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, ${todayXp}, 'seed', 'seed', 'yesterday', '${daysAgoIso(1)}'
      FROM users u WHERE u.clerk_id = '${clerkId}';`);
    out.push(`INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, ${Math.round(u.xp_total - 2 * todayXp)}, 'seed', 'seed', 'backfill', '${daysAgoIso(u.days_active)}'
      FROM users u WHERE u.clerk_id = '${clerkId}'
        AND NOT EXISTS (SELECT 1 FROM xp_events e2 WHERE e2.user_id = u.id AND e2.ref_id = 'backfill');`);
    out.push("");
  }

  await mkdir(resolve("drizzle/seed"), { recursive: true });
  await writeFile(OUT_PATH, out.join("\n"));

  console.log(`Wrote ${OUT_PATH}`);

  if (EMIT_ONLY) {
    console.log("--emit-only: skipping wrangler execute");
    return;
  }

  const flag = REMOTE ? "--remote" : "--local";
  console.log(`Applying via wrangler d1 execute ${flag}...`);
  execSync(`pnpm wrangler d1 execute lekkertaal_db ${flag} --file=${OUT_PATH}`, {
    stdio: "inherit",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
