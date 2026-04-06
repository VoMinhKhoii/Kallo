ALTER TABLE "meal_items" ADD COLUMN "meal_item_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_items" ADD COLUMN "meal_item_order" integer DEFAULT 0 NOT NULL;