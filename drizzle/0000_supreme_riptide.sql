CREATE TABLE `badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title_nl` text NOT NULL,
	`title_en` text NOT NULL,
	`description` text,
	`icon_emoji` text,
	`icon_asset` text,
	`rule` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `badges_slug_unique` ON `badges` (`slug`);--> statement-breakpoint
CREATE TABLE `coin_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`ref_type` text,
	`ref_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_coin_user` ON `coin_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cefr_level` text NOT NULL,
	`language` text DEFAULT 'nl' NOT NULL,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_slug_unique` ON `courses` (`slug`);--> statement-breakpoint
CREATE TABLE `daily_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`xp_earned` integer DEFAULT 0 NOT NULL,
	`lessons_completed` integer DEFAULT 0 NOT NULL,
	`drills_completed` integer DEFAULT 0 NOT NULL,
	`freeze_used` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dc_user_date` ON `daily_completions` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lesson_id` integer,
	`unit_slug` text,
	`slug` text NOT NULL,
	`type` text NOT NULL,
	`prompt_nl` text,
	`prompt_en` text,
	`options` text,
	`answer` text,
	`hints` text,
	`source_ref` text,
	`audio_url` text,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_slug_unique` ON `exercises` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_exercises_lesson` ON `exercises` (`lesson_id`);--> statement-breakpoint
CREATE INDEX `idx_exercises_unit_slug` ON `exercises` (`unit_slug`);--> statement-breakpoint
CREATE INDEX `idx_exercises_type` ON `exercises` (`type`);--> statement-breakpoint
CREATE TABLE `grammar_concepts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title_nl` text NOT NULL,
	`title_en` text NOT NULL,
	`explanation_md` text,
	`cefr_level` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grammar_concepts_slug_unique` ON `grammar_concepts` (`slug`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`unit_id` integer NOT NULL,
	`slug` text NOT NULL,
	`title_nl` text NOT NULL,
	`title_en` text NOT NULL,
	`order` integer NOT NULL,
	`xp_reward` integer DEFAULT 10 NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_slug_unique` ON `lessons` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_lessons_unit` ON `lessons` (`unit_id`,`order`);--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`channel` text NOT NULL,
	`kind` text NOT NULL,
	`sent_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`result` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_nl_user` ON `notification_log` (`user_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth_key` text NOT NULL,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ps_user` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ps_endpoint` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `roleplay_errors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`category` text NOT NULL,
	`incorrect` text NOT NULL,
	`correction` text NOT NULL,
	`explanation_en` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `roleplay_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_re_user` ON `roleplay_errors` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_re_session` ON `roleplay_errors` (`session_id`);--> statement-breakpoint
CREATE TABLE `roleplay_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`scenario_id` integer NOT NULL,
	`transcript` text,
	`rubric_grammar` integer,
	`rubric_vocab` integer,
	`rubric_task` integer,
	`rubric_fluency` integer,
	`rubric_politeness` integer,
	`feedback_md` text,
	`xp_awarded` integer DEFAULT 0 NOT NULL,
	`passed` integer DEFAULT false NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rs_user` ON `roleplay_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_rs_scenario` ON `roleplay_sessions` (`scenario_id`);--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`unit_id` integer,
	`unit_slug` text,
	`slug` text NOT NULL,
	`title_nl` text NOT NULL,
	`title_en` text NOT NULL,
	`difficulty` text DEFAULT 'A2' NOT NULL,
	`npc_name` text NOT NULL,
	`npc_persona` text NOT NULL,
	`npc_voice_id` text,
	`opening_nl` text NOT NULL,
	`must_use_vocab` text,
	`must_use_grammar` text,
	`success_criteria` text,
	`failure_modes` text,
	`estimated_minutes` integer DEFAULT 10 NOT NULL,
	`xp_reward` integer DEFAULT 50 NOT NULL,
	`badge_unlock` text,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenarios_slug_unique` ON `scenarios` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_scenarios_unit` ON `scenarios` (`unit_id`);--> statement-breakpoint
CREATE TABLE `spaced_rep_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`item_type` text NOT NULL,
	`item_key` text NOT NULL,
	`payload` text,
	`ease_factor` real DEFAULT 2.5 NOT NULL,
	`interval_days` integer DEFAULT 1 NOT NULL,
	`repetitions` integer DEFAULT 0 NOT NULL,
	`next_review_date` text NOT NULL,
	`last_reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_srq_user_due` ON `spaced_rep_queue` (`user_id`,`next_review_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_srq_user_item` ON `spaced_rep_queue` (`user_id`,`item_type`,`item_key`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer,
	`slug` text NOT NULL,
	`title_nl` text NOT NULL,
	`title_en` text NOT NULL,
	`description` text,
	`cefr_level` text NOT NULL,
	`order` integer NOT NULL,
	`grammar_concept_slug` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `units_slug_unique` ON `units` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_units_order` ON `units` (`cefr_level`,`order`);--> statement-breakpoint
CREATE TABLE `user_badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`badge_id` integer NOT NULL,
	`awarded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ub_user_badge` ON `user_badges` (`user_id`,`badge_id`);--> statement-breakpoint
CREATE TABLE `user_lesson_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`lesson_id` integer NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`incorrect_count` integer DEFAULT 0 NOT NULL,
	`xp_earned` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ulp_user` ON `user_lesson_progress` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ulp_user_lesson` ON `user_lesson_progress` (`user_id`,`lesson_id`);--> statement-breakpoint
CREATE TABLE `user_unit_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`unit_id` integer NOT NULL,
	`status` text DEFAULT 'locked' NOT NULL,
	`lessons_completed` integer DEFAULT 0 NOT NULL,
	`lessons_total` integer DEFAULT 0 NOT NULL,
	`boss_fight_passed` integer DEFAULT false NOT NULL,
	`started_at` text,
	`completed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_uup_user` ON `user_unit_progress` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_uup_user_unit` ON `user_unit_progress` (`user_id`,`unit_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clerk_id` text NOT NULL,
	`email` text,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`cefr_level` text DEFAULT 'A2' NOT NULL,
	`timezone` text DEFAULT 'Europe/Amsterdam' NOT NULL,
	`reminder_hour` integer DEFAULT 20 NOT NULL,
	`reminder_enabled` integer DEFAULT true NOT NULL,
	`streak_days` integer DEFAULT 0 NOT NULL,
	`streak_freezes_balance` integer DEFAULT 0 NOT NULL,
	`streak_last_active_date` text,
	`xp_total` integer DEFAULT 0 NOT NULL,
	`coins_balance` integer DEFAULT 0 NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`onboarded_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_clerk_id_unique` ON `users` (`clerk_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_xp_total` ON `users` (`xp_total`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_display_name` ON `users` (`display_name`);--> statement-breakpoint
CREATE TABLE `vocab` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nl` text NOT NULL,
	`en` text NOT NULL,
	`example_sentence_nl` text,
	`example_sentence_en` text,
	`source_image_path` text,
	`cefr_level` text DEFAULT 'A2' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_vocab_nl` ON `vocab` (`nl`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_vocab_nl_en` ON `vocab` (`nl`,`en`);--> statement-breakpoint
CREATE TABLE `xp_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`ref_type` text,
	`ref_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_xp_user_date` ON `xp_events` (`user_id`,`created_at`);