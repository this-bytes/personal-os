CREATE TABLE `conversation_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`agent_connection_id` text NOT NULL,
	`session_id` text NOT NULL,
	`continuity` text DEFAULT 'fresh' NOT NULL,
	`capabilities_revision` integer,
	`established_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_sessions_conversation_agent_idx` ON `conversation_sessions` (`conversation_id`,`agent_connection_id`);--> statement-breakpoint
CREATE INDEX `conversation_sessions_workspace_idx` ON `conversation_sessions` (`workspace_id`);--> statement-breakpoint
ALTER TABLE `executions` ADD `committed_revision` text;--> statement-breakpoint
ALTER TABLE `executions` ADD `idempotency_key` text;--> statement-breakpoint
ALTER TABLE `executions` ADD `correlation_id` text;--> statement-breakpoint
CREATE INDEX `executions_correlation_idx` ON `executions` (`correlation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `executions_idempotency_key_idx` ON `executions` (`idempotency_key`);