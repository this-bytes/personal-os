CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`execution_id` text,
	`conversation_id` text,
	`task_id` text,
	`agent_connection_id` text,
	`summary` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`requested_by` text,
	`decided_by` text,
	`created_at` text NOT NULL,
	`decided_at` text
);
--> statement-breakpoint
CREATE INDEX `approvals_workspace_idx` ON `approvals` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `approvals_status_idx` ON `approvals` (`status`);