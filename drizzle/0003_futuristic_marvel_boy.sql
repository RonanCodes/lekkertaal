CREATE TABLE `friendships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requester_id` integer NOT NULL,
	`addressee_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addressee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_friendships_requester` ON `friendships` (`requester_id`);--> statement-breakpoint
CREATE INDEX `idx_friendships_addressee` ON `friendships` (`addressee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_friendships_pair` ON `friendships` (`requester_id`,`addressee_id`);