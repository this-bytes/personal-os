CREATE TABLE `blocked_capabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`agent_connection_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`first_refused_at` text NOT NULL,
	`last_refused_at` text NOT NULL,
	`refusal_count` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`agent_connection_id`) REFERENCES `agent_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocked_capabilities_agent_tool_idx` ON `blocked_capabilities` (`agent_connection_id`,`tool_name`);--> statement-breakpoint
CREATE INDEX `blocked_capabilities_workspace_idx` ON `blocked_capabilities` (`workspace_id`);
