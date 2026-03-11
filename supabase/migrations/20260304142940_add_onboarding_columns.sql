ALTER TABLE "user_profiles" ADD COLUMN "carb_split" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "hand_span_cm" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "knuckle_depth_cm" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "onboarding_step" smallint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_carb_split_check" CHECK ("user_profiles"."carb_split" IN ('moderate_carb', 'lower_carb', 'higher_carb'));