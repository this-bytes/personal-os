ALTER TABLE `agent_connections` ADD `capabilities_revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `executions` ADD `capability_view` text;