ALTER TABLE `users` ADD `slow_replay_default` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_friend_pings` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_streak_alerts` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_email_digest` integer DEFAULT 1 NOT NULL;
