CREATE TABLE `speak_drill_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`drill_id` integer NOT NULL,
	`score` integer NOT NULL,
	`passed` integer NOT NULL,
	`transcript` text NOT NULL,
	`audio_key` text,
	`xp_awarded` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`drill_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_speak_attempts_user` ON `speak_drill_attempts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_speak_attempts_user_drill` ON `speak_drill_attempts` (`user_id`,`drill_id`);