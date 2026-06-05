ALTER TABLE "meals" ADD COLUMN "entry_mode" text DEFAULT 'precise' NOT NULL;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "alcohol_g" numeric;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "cheat_sliders" jsonb;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "estimate_rationale" text;--> statement-breakpoint
ALTER TABLE "pending_analyses" ADD COLUMN "entry_mode" text DEFAULT 'precise' NOT NULL;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_entry_mode_check" CHECK ("meals"."entry_mode" IN ('precise', 'cheat'));--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_alcohol_g_non_negative_check" CHECK ("meals"."alcohol_g" IS NULL OR "meals"."alcohol_g" >= 0);--> statement-breakpoint
ALTER TABLE "pending_analyses" ADD CONSTRAINT "pending_analyses_entry_mode_check" CHECK ("pending_analyses"."entry_mode" IN ('precise', 'cheat'));
