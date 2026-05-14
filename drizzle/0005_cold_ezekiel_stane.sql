CREATE TABLE `daily_quests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`target` integer NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`claimed` integer DEFAULT false NOT NULL,
	`bonus_xp` integer DEFAULT 15 NOT NULL,
	`bonus_coins` integer DEFAULT 5 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`claimed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_daily_quests_user_date` ON `daily_quests` (`user_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_daily_quests_user_date_kind` ON `daily_quests` (`user_id`,`date`,`kind`);