-- US-035: demo users for non-empty leaderboard.
-- Idempotent — re-running is safe.
-- Ronan
INSERT OR IGNORE INTO users
      (clerk_id, email, display_name, cefr_level, streak_days, xp_total,
       coins_balance, streak_freezes_balance, hints_balance, sfx_enabled,
       is_public, streak_last_active_date, onboarded_at)
      VALUES (
        'seed_ronan',
        'ronan@example.com',
        'Ronan',
        'A2',
        14,
        720,
        60,
        1,
        2,
        1,
        1,
        '2026-05-13',
        '2026-04-29T21:28:51.251Z'
      );
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-04-29T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_ronan' AND n.slug = 'a2-unit-1-werkwoorden-hebben-zijn';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-04-29T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_ronan' AND n.slug = 'a2-unit-2-werkwoordsspelling';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-04-29T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_ronan' AND n.slug = 'a2-unit-3-perfectum';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, updated_at)
      SELECT u.id, n.id, 'in_progress', 2, 5, '2026-05-10T21:28:51.251Z', '2026-05-13T21:28:51.251Z'
      FROM users u, units n
      WHERE u.clerk_id = 'seed_ronan' AND n.slug = 'a2-unit-4-imperfectum';
INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, 51, 'seed', 'seed', 'today', '2026-05-13T21:28:51.251Z'
      FROM users u WHERE u.clerk_id = 'seed_ronan';
INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, 51, 'seed', 'seed', 'yesterday', '2026-05-12T21:28:51.251Z'
      FROM users u WHERE u.clerk_id = 'seed_ronan';
INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, 618, 'seed', 'seed', 'backfill', '2026-04-29T21:28:51.251Z'
      FROM users u WHERE u.clerk_id = 'seed_ronan'
        AND NOT EXISTS (SELECT 1 FROM xp_events e2 WHERE e2.user_id = u.id AND e2.ref_id = 'backfill');

-- Mehmet
INSERT OR IGNORE INTO users
      (clerk_id, email, display_name, cefr_level, streak_days, xp_total,
       coins_balance, streak_freezes_balance, hints_balance, sfx_enabled,
       is_public, streak_last_active_date, onboarded_at)
      VALUES (
        'seed_mehmet',
        'mehmet@example.com',
        'Mehmet',
        'A2',
        21,
        980,
        110,
        2,
        0,
        1,
        1,
        '2026-05-13',
        '2026-04-22T21:28:51.251Z'
      );
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-04-22T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_mehmet' AND n.slug = 'a2-unit-1-werkwoorden-hebben-zijn';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-04-22T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_mehmet' AND n.slug = 'a2-unit-2-werkwoordsspelling';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-04-22T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_mehmet' AND n.slug = 'a2-unit-3-perfectum';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, updated_at)
      SELECT u.id, n.id, 'in_progress', 4, 5, '2026-05-10T21:28:51.251Z', '2026-05-13T21:28:51.251Z'
      FROM users u, units n
      WHERE u.clerk_id = 'seed_mehmet' AND n.slug = 'a2-unit-4-imperfectum';
INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, 47, 'seed', 'seed', 'today', '2026-05-13T21:28:51.251Z'
      FROM users u WHERE u.clerk_id = 'seed_mehmet';
INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, 47, 'seed', 'seed', 'yesterday', '2026-05-12T21:28:51.251Z'
      FROM users u WHERE u.clerk_id = 'seed_mehmet';
INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, 886, 'seed', 'seed', 'backfill', '2026-04-22T21:28:51.251Z'
      FROM users u WHERE u.clerk_id = 'seed_mehmet'
        AND NOT EXISTS (SELECT 1 FROM xp_events e2 WHERE e2.user_id = u.id AND e2.ref_id = 'backfill');

-- Judith
INSERT OR IGNORE INTO users
      (clerk_id, email, display_name, cefr_level, streak_days, xp_total,
       coins_balance, streak_freezes_balance, hints_balance, sfx_enabled,
       is_public, streak_last_active_date, onboarded_at)
      VALUES (
        'seed_judith',
        'judith@example.com',
        'Judith',
        'A2',
        14,
        690,
        55,
        1,
        1,
        1,
        1,
        '2026-05-13',
        '2026-04-29T21:28:51.251Z'
      );
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-04-29T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_judith' AND n.slug = 'a2-unit-1-werkwoorden-hebben-zijn';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-04-29T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_judith' AND n.slug = 'a2-unit-2-werkwoordsspelling';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-04-29T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_judith' AND n.slug = 'a2-unit-3-perfectum';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, updated_at)
      SELECT u.id, n.id, 'in_progress', 1, 5, '2026-05-10T21:28:51.251Z', '2026-05-13T21:28:51.251Z'
      FROM users u, units n
      WHERE u.clerk_id = 'seed_judith' AND n.slug = 'a2-unit-4-imperfectum';
INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, 49, 'seed', 'seed', 'today', '2026-05-13T21:28:51.251Z'
      FROM users u WHERE u.clerk_id = 'seed_judith';
INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, 49, 'seed', 'seed', 'yesterday', '2026-05-12T21:28:51.251Z'
      FROM users u WHERE u.clerk_id = 'seed_judith';
INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, 592, 'seed', 'seed', 'backfill', '2026-04-29T21:28:51.251Z'
      FROM users u WHERE u.clerk_id = 'seed_judith'
        AND NOT EXISTS (SELECT 1 FROM xp_events e2 WHERE e2.user_id = u.id AND e2.ref_id = 'backfill');

-- Michiel
INSERT OR IGNORE INTO users
      (clerk_id, email, display_name, cefr_level, streak_days, xp_total,
       coins_balance, streak_freezes_balance, hints_balance, sfx_enabled,
       is_public, streak_last_active_date, onboarded_at)
      VALUES (
        'seed_michiel',
        'michiel@example.com',
        'Michiel',
        'A2',
        7,
        1480,
        180,
        3,
        0,
        1,
        1,
        '2026-05-13',
        '2026-05-06T21:28:51.251Z'
      );
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-05-06T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_michiel' AND n.slug = 'a2-unit-1-werkwoorden-hebben-zijn';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-05-06T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_michiel' AND n.slug = 'a2-unit-2-werkwoordsspelling';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-05-06T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_michiel' AND n.slug = 'a2-unit-3-perfectum';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-05-06T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_michiel' AND n.slug = 'a2-unit-4-imperfectum';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, completed_at, updated_at)
        SELECT u.id, n.id, 'completed', 5, 5, '2026-05-06T21:28:51.251Z', '2026-05-11T21:28:51.251Z', '2026-05-11T21:28:51.251Z'
        FROM users u, units n
        WHERE u.clerk_id = 'seed_michiel' AND n.slug = 'a2-unit-5-vier-seizoenen';
INSERT OR IGNORE INTO user_unit_progress (user_id, unit_id, status, lessons_completed, lessons_total, started_at, updated_at)
      SELECT u.id, n.id, 'in_progress', 1, 5, '2026-05-10T21:28:51.251Z', '2026-05-13T21:28:51.251Z'
      FROM users u, units n
      WHERE u.clerk_id = 'seed_michiel' AND n.slug = 'a2-unit-6-iets-te-veel-van-het-goede';
INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, 211, 'seed', 'seed', 'today', '2026-05-13T21:28:51.251Z'
      FROM users u WHERE u.clerk_id = 'seed_michiel';
INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, 211, 'seed', 'seed', 'yesterday', '2026-05-12T21:28:51.251Z'
      FROM users u WHERE u.clerk_id = 'seed_michiel';
INSERT INTO xp_events (user_id, delta, reason, ref_type, ref_id, created_at)
      SELECT u.id, 1058, 'seed', 'seed', 'backfill', '2026-05-06T21:28:51.251Z'
      FROM users u WHERE u.clerk_id = 'seed_michiel'
        AND NOT EXISTS (SELECT 1 FROM xp_events e2 WHERE e2.user_id = u.id AND e2.ref_id = 'backfill');
