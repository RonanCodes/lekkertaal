CREATE TABLE `leagues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`tier` integer NOT NULL,
	`week_start_date` text NOT NULL,
	`weekly_xp` integer DEFAULT 0 NOT NULL,
	`final_rank` integer,
	`movement` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_leagues_user` ON `leagues` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_leagues_week_tier` ON `leagues` (`week_start_date`,`tier`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_leagues_user_week` ON `leagues` (`user_id`,`week_start_date`);
