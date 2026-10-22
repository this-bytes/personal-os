ALTER TABLE `automations` ADD `template_id` text;--> statement-breakpoint
ALTER TABLE `automations` ADD `template_version` integer;--> statement-breakpoint
ALTER TABLE `resources` ADD `template_id` text;--> statement-breakpoint
ALTER TABLE `resources` ADD `template_version` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `template_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `template_version` integer;