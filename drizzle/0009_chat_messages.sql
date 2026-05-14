CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`client_message_id` text NOT NULL,
	`role` text NOT NULL,
	`parts` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `roleplay_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_messages_session` ON `chat_messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_user` ON `chat_messages` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chat_messages_client` ON `chat_messages` (`session_id`,`client_message_id`);