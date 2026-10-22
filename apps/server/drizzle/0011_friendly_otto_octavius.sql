CREATE TABLE `bots` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`agent_connection_id` text NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`may_dispatch` integer DEFAULT false NOT NULL,
	`dispatchable_agent_connection_ids` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bots_conversation_idx` ON `bots` (`conversation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bots_conversation_agent_idx` ON `bots` (`conversation_id`,`agent_connection_id`);--> statement-breakpoint
CREATE TABLE `delegated_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`child_conversation_id` text NOT NULL,
	`parent_turn_id` text NOT NULL,
	`child_turn_id` text,
	`parent_agent_connection_id` text NOT NULL,
	`agent_connection_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`task_id` text,
	`instruction` text NOT NULL,
	`result` text,
	`output_ref` text,
	`delivery_message_id` text,
	`delivered_at` text,
	`consumed_at` text,
	`depth` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `delegated_tasks_conversation_idx` ON `delegated_tasks` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `delegated_tasks_child_turn_idx` ON `delegated_tasks` (`child_turn_id`);--> statement-breakpoint
CREATE INDEX `delegated_tasks_parent_turn_idx` ON `delegated_tasks` (`parent_turn_id`);