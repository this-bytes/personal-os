ALTER TABLE `automations` ADD `created_by` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `created_by` text DEFAULT 'system' NOT NULL;