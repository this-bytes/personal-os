ALTER TABLE `messages` ADD `delivery` text DEFAULT 'queue' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `consumed_at` text;