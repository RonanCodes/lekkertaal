import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Lekkertaal schema (Phase 1 v0).
 *
 * SQLite / D1 dialect. All ID-bearing tables use integer auto-increment PKs
 * except `users` (clerkId is also unique) and join tables.
 *
 * Convention:
 *  - snake_case columns
 *  - `created_at` / `updated_at` default to CURRENT_TIMESTAMP (text ISO8601)
 *  - boolean stored as 0/1 via { mode: "boolean" }
 *  - JSON blobs stored as text via { mode: "json" } with explicit type
 */

// ============================================================================
// USERS + ENGAGEMENT
// ============================================================================

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clerkId: text("clerk_id").notNull().unique(),
    email: text("email").unique(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    cefrLevel: text("cefr_level").default("A2").notNull(),
    timezone: text("timezone").default("Europe/Amsterdam").notNull(),
    reminderHour: integer("reminder_hour").default(20).notNull(),
    reminderEnabled: integer("reminder_enabled", { mode: "boolean" }).default(true).notNull(),
    streakDays: integer("streak_days").default(0).notNull(),
    streakFreezesBalance: integer("streak_freezes_balance").default(0).notNull(),
    streakLastActiveDate: text("streak_last_active_date"),
    xpTotal: integer("xp_total").default(0).notNull(),
    coinsBalance: integer("coins_balance").default(0).notNull(),
    hintsBalance: integer("hints_balance").default(0).notNull(),
    sfxEnabled: integer("sfx_enabled", { mode: "boolean" }).default(true).notNull(),
    isPublic: integer("is_public", { mode: "boolean" }).default(true).notNull(),
    onboardedAt: text("onboarded_at"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    byXp: index("idx_users_xp_total").on(t.xpTotal),
    byDisplayName: uniqueIndex("idx_users_display_name").on(t.displayName),
  }),
);

// ============================================================================
// CONTENT: courses, units, lessons, exercises, vocab, grammar, scenarios
// ============================================================================

export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  cefrLevel: text("cefr_level").notNull(),
  language: text("language").default("nl").notNull(),
  isPublished: integer("is_published", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const grammarConcepts = sqliteTable("grammar_concepts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  titleNl: text("title_nl").notNull(),
  titleEn: text("title_en").notNull(),
  explanationMd: text("explanation_md"),
  cefrLevel: text("cefr_level").notNull(),
});

export const units = sqliteTable(
  "units",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id").references(() => courses.id),
    slug: text("slug").notNull().unique(),
    titleNl: text("title_nl").notNull(),
    titleEn: text("title_en").notNull(),
    description: text("description"),
    cefrLevel: text("cefr_level").notNull(),
    order: integer("order").notNull(),
    grammarConceptSlug: text("grammar_concept_slug"),
  },
  (t) => ({
    byOrder: index("idx_units_order").on(t.cefrLevel, t.order),
  }),
);

export const lessons = sqliteTable(
  "lessons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    unitId: integer("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    titleNl: text("title_nl").notNull(),
    titleEn: text("title_en").notNull(),
    order: integer("order").notNull(),
    xpReward: integer("xp_reward").default(10).notNull(),
  },
  (t) => ({
    byUnit: index("idx_lessons_unit").on(t.unitId, t.order),
  }),
);

/**
 * Exercise (a single drill question).
 * type ∈ match_pairs | multiple_choice | translation_typing | fill_blank | word_ordering | listening_mc
 */
export const exercises = sqliteTable(
  "exercises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lessonId: integer("lesson_id").references(() => lessons.id, { onDelete: "cascade" }),
    unitSlug: text("unit_slug"),
    slug: text("slug").notNull().unique(),
    type: text("type").notNull(),
    promptNl: text("prompt_nl"),
    promptEn: text("prompt_en"),
    options: text("options", { mode: "json" }).$type<unknown[]>(),
    answer: text("answer", { mode: "json" }).$type<unknown>(),
    hints: text("hints", { mode: "json" }).$type<string[]>(),
    sourceRef: text("source_ref"),
    audioUrl: text("audio_url"),
  },
  (t) => ({
    byLesson: index("idx_exercises_lesson").on(t.lessonId),
    byUnitSlug: index("idx_exercises_unit_slug").on(t.unitSlug),
    byType: index("idx_exercises_type").on(t.type),
  }),
);

export const vocab = sqliteTable(
  "vocab",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nl: text("nl").notNull(),
    en: text("en").notNull(),
    exampleSentenceNl: text("example_sentence_nl"),
    exampleSentenceEn: text("example_sentence_en"),
    sourceImagePath: text("source_image_path"),
    cefrLevel: text("cefr_level").default("A2").notNull(),
  },
  (t) => ({
    byNl: index("idx_vocab_nl").on(t.nl),
    uniqPair: uniqueIndex("idx_vocab_nl_en").on(t.nl, t.en),
  }),
);

export const scenarios = sqliteTable(
  "scenarios",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    unitId: integer("unit_id").references(() => units.id),
    unitSlug: text("unit_slug"),
    slug: text("slug").notNull().unique(),
    titleNl: text("title_nl").notNull(),
    titleEn: text("title_en").notNull(),
    difficulty: text("difficulty").default("A2").notNull(),
    npcName: text("npc_name").notNull(),
    npcPersona: text("npc_persona").notNull(),
    npcVoiceId: text("npc_voice_id"),
    openingNl: text("opening_nl").notNull(),
    mustUseVocab: text("must_use_vocab", { mode: "json" }).$type<string[]>(),
    mustUseGrammar: text("must_use_grammar", { mode: "json" }).$type<string[]>(),
    successCriteria: text("success_criteria", { mode: "json" }).$type<string[]>(),
    failureModes: text("failure_modes", { mode: "json" }).$type<string[]>(),
    estimatedMinutes: integer("estimated_minutes").default(10).notNull(),
    xpReward: integer("xp_reward").default(50).notNull(),
    badgeUnlock: text("badge_unlock"),
  },
  (t) => ({
    byUnit: index("idx_scenarios_unit").on(t.unitId),
  }),
);

// ============================================================================
// PROGRESS
// ============================================================================

export const userUnitProgress = sqliteTable(
  "user_unit_progress",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    unitId: integer("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    status: text("status").default("locked").notNull(), // locked | unlocked | in_progress | completed
    lessonsCompleted: integer("lessons_completed").default(0).notNull(),
    lessonsTotal: integer("lessons_total").default(0).notNull(),
    bossFightPassed: integer("boss_fight_passed", { mode: "boolean" }).default(false).notNull(),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    byUser: index("idx_uup_user").on(t.userId),
    uniqUserUnit: uniqueIndex("idx_uup_user_unit").on(t.userId, t.unitId),
  }),
);

export const userLessonProgress = sqliteTable(
  "user_lesson_progress",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    status: text("status").default("not_started").notNull(),
    correctCount: integer("correct_count").default(0).notNull(),
    incorrectCount: integer("incorrect_count").default(0).notNull(),
    xpEarned: integer("xp_earned").default(0).notNull(),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    byUser: index("idx_ulp_user").on(t.userId),
    uniqUserLesson: uniqueIndex("idx_ulp_user_lesson").on(t.userId, t.lessonId),
  }),
);

// ============================================================================
// ROLEPLAY
// ============================================================================

export const roleplaySessions = sqliteTable(
  "roleplay_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scenarioId: integer("scenario_id")
      .notNull()
      .references(() => scenarios.id),
    transcript: text("transcript", { mode: "json" }).$type<
      Array<{ role: "user" | "assistant" | "system"; content: string; ts: string }>
    >(),
    rubricGrammar: integer("rubric_grammar"),
    rubricVocab: integer("rubric_vocab"),
    rubricTask: integer("rubric_task"),
    rubricFluency: integer("rubric_fluency"),
    rubricPoliteness: integer("rubric_politeness"),
    feedbackMd: text("feedback_md"),
    xpAwarded: integer("xp_awarded").default(0).notNull(),
    passed: integer("passed", { mode: "boolean" }).default(false).notNull(),
    startedAt: text("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    completedAt: text("completed_at"),
  },
  (t) => ({
    byUser: index("idx_rs_user").on(t.userId),
    byScenario: index("idx_rs_scenario").on(t.scenarioId),
  }),
);

export const roleplayErrors = sqliteTable(
  "roleplay_errors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => roleplaySessions.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(), // grammar | vocab | spelling | register
    incorrect: text("incorrect").notNull(),
    correction: text("correction").notNull(),
    explanationEn: text("explanation_en"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    byUser: index("idx_re_user").on(t.userId),
    bySession: index("idx_re_session").on(t.sessionId),
  }),
);

/**
 * Per-message append-only store for roleplay chat.
 *
 * AI SDK v6 persistence + resume pattern: client ships only the latest user
 * message + a stable `useChat` id; the server reloads history from this
 * table, appends the new user turn, calls `streamText`, then writes the
 * assistant turn back inside `toUIMessageStreamResponse({ onFinish })`.
 *
 * `roleplay_sessions.transcript` (JSON) stays in sync as a denormalised
 * mirror so the grader keeps working unchanged. This table is the
 * source-of-truth for resume; the JSON column is convenience for grading
 * and old code that scans whole transcripts.
 *
 * `clientMessageId` is the v6 stable id (e.g. `msg-abc123`) the client uses
 * for React keys and idempotency; unique per session so duplicate submits
 * from a flaky network don't double-insert.
 *
 * `parts` is the raw `UIMessage.parts[]` blob (`{ type: "text", text: ... }`
 * etc). Stored as JSON so we round-trip tool calls and future multimodal
 * parts without schema churn.
 */
export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => roleplaySessions.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientMessageId: text("client_message_id").notNull(),
    role: text("role").notNull(), // "user" | "assistant" | "system"
    parts: text("parts", { mode: "json" }).$type<
      Array<{ type: string; text?: string; [k: string]: unknown }>
    >().notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    bySession: index("idx_chat_messages_session").on(t.sessionId, t.createdAt),
    byUser: index("idx_chat_messages_user").on(t.userId),
    uniqClient: uniqueIndex("idx_chat_messages_client").on(t.sessionId, t.clientMessageId),
  }),
);

// ============================================================================
// SPEECH-TO-TEXT (STT)
// ============================================================================

/**
 * Whisper transcription record.
 *
 * One row per /api/stt/transcribe call. Stores the R2 audio key (so the raw
 * clip is retrievable for debugging or pronunciation rescoring), the
 * transcript Whisper returned, and the clip duration the client claimed.
 *
 * `drillId` is nullable: STT can be invoked outside a drill context (free
 * speak mode, future pronunciation tester, etc.). When tied to a specific
 * exercise we set it so the speak-mode drill can join back later.
 */
export const transcripts = sqliteTable(
  "transcripts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    drillId: integer("drill_id").references(() => exercises.id),
    audioKey: text("audio_key").notNull(),
    transcript: text("transcript").notNull(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    byUser: index("idx_transcripts_user").on(t.userId, t.createdAt),
    byDrill: index("idx_transcripts_drill").on(t.drillId),
  }),
);

/**
 * Speak-drill attempt log (P2-STT-3 #56).
 *
 * One row per scored speak-drill attempt. Records the score, transcript, and
 * R2 audio key for the clip. `passed` is a denormalised boolean (score >= 80)
 * so the daily-quests speak-progress query can index a single column instead
 * of recomputing per-row.
 *
 * The unique (userId, drillId, passed=true) constraint is enforced at the
 * application layer (not as a DB constraint) so a learner can retry a drill
 * many times without inflating their XP. The route awards XP only on the
 * first passing attempt for each (userId, drillId) pair; subsequent retries
 * are logged for analytics but yield no XP.
 */
export const speakDrillAttempts = sqliteTable(
  "speak_drill_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    drillId: integer("drill_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    passed: integer("passed", { mode: "boolean" }).notNull(),
    transcript: text("transcript").notNull(),
    audioKey: text("audio_key"),
    xpAwarded: integer("xp_awarded").default(0).notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    byUser: index("idx_speak_attempts_user").on(t.userId, t.createdAt),
    byUserDrill: index("idx_speak_attempts_user_drill").on(t.userId, t.drillId),
  }),
);

// ============================================================================
// SPACED REPETITION (SM-2)
// ============================================================================

export const spacedRepQueue = sqliteTable(
  "spaced_rep_queue",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(), // vocab | exercise | grammar | roleplay_error
    itemKey: text("item_key").notNull(), // stable key into the source table
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    easeFactor: real("ease_factor").default(2.5).notNull(),
    intervalDays: integer("interval_days").default(1).notNull(),
    repetitions: integer("repetitions").default(0).notNull(),
    nextReviewDate: text("next_review_date").notNull(),
    lastReviewedAt: text("last_reviewed_at"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    byUserDue: index("idx_srq_user_due").on(t.userId, t.nextReviewDate),
    byKey: uniqueIndex("idx_srq_user_item").on(t.userId, t.itemType, t.itemKey),
  }),
);

// ============================================================================
// XP / COINS / DAILY COMPLETIONS / NOTIFICATIONS
// ============================================================================

export const xpEvents = sqliteTable(
  "xp_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(), // lesson_complete | roleplay | streak_bonus | badge | placement | seed
    refType: text("ref_type"),
    refId: text("ref_id"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    byUserDate: index("idx_xp_user_date").on(t.userId, t.createdAt),
  }),
);

export const coinEvents = sqliteTable(
  "coin_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    byUser: index("idx_coin_user").on(t.userId, t.createdAt),
  }),
);

export const dailyCompletions = sqliteTable(
  "daily_completions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD in user's timezone
    xpEarned: integer("xp_earned").default(0).notNull(),
    lessonsCompleted: integer("lessons_completed").default(0).notNull(),
    drillsCompleted: integer("drills_completed").default(0).notNull(),
    freezeUsed: integer("freeze_used", { mode: "boolean" }).default(false).notNull(),
  },
  (t) => ({
    uniqUserDate: uniqueIndex("idx_dc_user_date").on(t.userId, t.date),
  }),
);

// ============================================================================
// DAILY QUESTS (P2-CON-3)
// ============================================================================

/**
 * Daily quest assignments.
 *
 * The cron handler seeds 3 quests per active user per local-tz day. Kinds:
 *   - xp       → "earn N XP today" (target = 30 | 50 | 100)
 *   - lessons  → "finish N lessons today" (target = 1 | 2 | 3)
 *   - streak   → "extend your streak today" (target = 1; bumps when streakDays grows)
 *   - speak    → "complete N speak drills" (target = 1 | 2). Wired by P2-STT-3 (#56).
 *
 * Idempotency: unique (userId, date, kind). The cron upserts; same-day reruns
 * are no-ops. `date` is YYYY-MM-DD in the user's local timezone.
 */
export const dailyQuests = sqliteTable(
  "daily_quests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD in user's local timezone
    kind: text("kind").notNull(), // xp | lessons | streak | speak
    target: integer("target").notNull(),
    progress: integer("progress").default(0).notNull(),
    completed: integer("completed", { mode: "boolean" }).default(false).notNull(),
    claimed: integer("claimed", { mode: "boolean" }).default(false).notNull(),
    bonusXp: integer("bonus_xp").default(15).notNull(),
    bonusCoins: integer("bonus_coins").default(5).notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    claimedAt: text("claimed_at"),
  },
  (t) => ({
    byUserDate: index("idx_daily_quests_user_date").on(t.userId, t.date),
    uniqUserDateKind: uniqueIndex("idx_daily_quests_user_date_kind").on(t.userId, t.date, t.kind),
  }),
);

// ============================================================================
// BADGES
// ============================================================================

export const badges = sqliteTable("badges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  titleNl: text("title_nl").notNull(),
  titleEn: text("title_en").notNull(),
  description: text("description"),
  iconEmoji: text("icon_emoji"),
  iconAsset: text("icon_asset"),
  rule: text("rule", { mode: "json" }).$type<{ kind: string; threshold?: number; key?: string }>(),
});

export const userBadges = sqliteTable(
  "user_badges",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeId: integer("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    awardedAt: text("awarded_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    uniqUserBadge: uniqueIndex("idx_ub_user_badge").on(t.userId, t.badgeId),
  }),
);

// ============================================================================
// PUSH / NOTIFICATIONS
// ============================================================================

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    authKey: text("auth_key").notNull(),
    userAgent: text("user_agent"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    byUser: index("idx_ps_user").on(t.userId),
    uniqEndpoint: uniqueIndex("idx_ps_endpoint").on(t.endpoint),
  }),
);

export const notificationLog = sqliteTable(
  "notification_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // push | email
    kind: text("kind").notNull(), // daily_nag | weekly_digest | streak_recovery
    sentAt: text("sent_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    result: text("result"),
  },
  (t) => ({
    byUser: index("idx_nl_user").on(t.userId, t.sentAt),
  }),
);

// ============================================================================
// LEAGUES (P2-ENG-1)
// ============================================================================

/**
 * Weekly league standings.
 *
 * Bronze → Diamond ladder of 10 tiers. Each Monday a cron rolls every user
 * into a new row for the week, then computes finalRank + movement for the
 * PREVIOUS week's rows based on weeklyXp. Top 7 promote, bottom 5 demote,
 * middle stay; no demotion below tier 1.
 *
 * Columns:
 *   - tier              Current tier 1..10
 *   - weekStartDate     ISO YYYY-MM-DD of the Monday the row covers (UTC)
 *   - weeklyXp          Cached sum(xp_events.delta) for the user across the week
 *   - finalRank         Position within the tier at week close (null until rolled)
 *   - movement          'up' | 'same' | 'down' once rolled
 *
 * Uniqueness on (userId, weekStartDate). The cron upserts.
 *
 * Feature gate: the cron only writes when active-user count >= 30 (see
 * `src/lib/server/leagues.ts`).
 */
export const leagues = sqliteTable(
  "leagues",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tier: integer("tier").notNull(),
    weekStartDate: text("week_start_date").notNull(), // YYYY-MM-DD (Mon, UTC)
    weeklyXp: integer("weekly_xp").default(0).notNull(),
    finalRank: integer("final_rank"),
    movement: text("movement"), // up | same | down (null until rolled)
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({
    byUser: index("idx_leagues_user").on(t.userId),
    byWeekTier: index("idx_leagues_week_tier").on(t.weekStartDate, t.tier),
    uniqUserWeek: uniqueIndex("idx_leagues_user_week").on(t.userId, t.weekStartDate),
  }),
);

// ============================================================================
// SOCIAL: friendships
// ============================================================================

/**
 * Symmetric opt-in friendship graph.
 *
 * One row per (requesterId, addresseeId) pair. The `requesterId` is the user
 * who initiated the request; `addresseeId` is the recipient. Status starts
 * `pending`; the addressee can transition it to `accepted` or `declined`.
 *
 * Symmetry is enforced at query time (see `src/lib/server/friends.ts`):
 * `list` and `pending` queries union both directions so an accepted row works
 * regardless of who originally sent it.
 *
 * Uniqueness: the ordered pair `(requesterId, addresseeId)` is unique. To
 * keep "dupe request" detection cheap we ALSO normalise inserts so the
 * smaller user id is always on one side when checking for an existing
 * accepted edge (see helper logic), but the underlying row preserves who
 * actually invited whom.
 */
export const friendships = sqliteTable(
  "friendships",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requesterId: integer("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: integer("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").default("pending").notNull(), // pending | accepted | declined
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    respondedAt: text("responded_at"),
  },
  (t) => ({
    byRequester: index("idx_friendships_requester").on(t.requesterId),
    byAddressee: index("idx_friendships_addressee").on(t.addresseeId),
    uniqPair: uniqueIndex("idx_friendships_pair").on(t.requesterId, t.addresseeId),
  }),
);

// ============================================================================
// SOCIAL: peer drills
// ============================================================================

/**
 * Peer drills — one friend sends another a Dutch sentence to translate.
 *
 * Send/receive flow:
 *   - Sender POSTs `/api/peer-drills/send` with `{ toUserId, prompt }`.
 *   - Recipient lists pending rows via `/api/peer-drills/inbox`.
 *   - Recipient submits an attempt via `/api/peer-drills/:id/submit`, which
 *     records the answer, flips status to `completed`, stamps `completedAt`,
 *     and writes an in-app notification back to the sender (channel="in_app",
 *     kind="peer_drill_completed").
 *
 * Both ends must be on an `accepted` friendships row; the HTTP layer enforces
 * this against `src/lib/server/friends.ts`.
 */
export const peerDrills = sqliteTable(
  "peer_drills",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fromUserId: integer("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: integer("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    expectedAnswerHint: text("expected_answer_hint"),
    status: text("status").default("pending").notNull(), // pending | completed | skipped
    answer: text("answer"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    completedAt: text("completed_at"),
  },
  (t) => ({
    byTo: index("idx_peer_drills_to").on(t.toUserId, t.status),
    byFrom: index("idx_peer_drills_from").on(t.fromUserId, t.status),
  }),
);

// ============================================================================
// Type exports
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Unit = typeof units.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Vocab = typeof vocab.$inferSelect;
export type Scenario = typeof scenarios.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type NewFriendship = typeof friendships.$inferInsert;
export type Transcript = typeof transcripts.$inferSelect;
export type NewTranscript = typeof transcripts.$inferInsert;
export type DailyQuest = typeof dailyQuests.$inferSelect;
export type NewDailyQuest = typeof dailyQuests.$inferInsert;
export type PeerDrill = typeof peerDrills.$inferSelect;
export type NewPeerDrill = typeof peerDrills.$inferInsert;
export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;
export type SpeakDrillAttempt = typeof speakDrillAttempts.$inferSelect;
export type NewSpeakDrillAttempt = typeof speakDrillAttempts.$inferInsert;
