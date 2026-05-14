CREATE TABLE `peer_drills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_user_id` integer NOT NULL,
	`to_user_id` integer NOT NULL,
	`prompt` text NOT NULL,
	`expected_answer_hint` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`answer` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_peer_drills_to` ON `peer_drills` (`to_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_peer_drills_from` ON `peer_drills` (`from_user_id`,`status`);
