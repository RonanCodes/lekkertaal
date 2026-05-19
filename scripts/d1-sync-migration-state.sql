-- One-time sync: backfill the `d1_migrations` tracking table so
-- `wrangler d1 migrations apply` knows that migrations 0000-0011 have
-- already been applied (they were, via the previous brute-force
-- `wrangler d1 execute --file=$f` loop in the deploy workflow).
--
-- 0012_vocab_enrichment.sql is NOT included here on purpose — that one
-- has NOT been applied yet (the deploys triggered by PR #165's merge
-- and onward all failed with CF rate-limit 10429). The next call to
-- `wrangler d1 migrations apply lekkertaal_db --remote` will pick it up
-- and apply it cleanly.
--
-- Run this ONCE, manually, BEFORE merging the workflow-switch PR:
--
--   wrangler d1 execute lekkertaal_db --remote \
--     --file=scripts/d1-sync-migration-state.sql
--
-- Idempotent: the IF NOT EXISTS guard handles the table create; the
-- INSERT statements use INSERT OR IGNORE so re-running is a no-op.

CREATE TABLE IF NOT EXISTS d1_migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS d1_migrations_name_unique ON d1_migrations(name);

INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0000_supreme_riptide.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0001_cool_exodus.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0002_lumpy_mentallo.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0003_futuristic_marvel_boy.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0004_parched_proemial_gods.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0005_cold_ezekiel_stane.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0006_peer_drills.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0007_leagues.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0008_speak_drill.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0009_chat_messages.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0010_image_drills.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0011_notification_read_at.sql');
