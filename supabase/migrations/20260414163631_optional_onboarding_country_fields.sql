SET search_path TO public, extensions;

ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_regional_profile_check";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_hand_span_cm_check";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_knuckle_depth_cm_check";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_onboarding_step_check";--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "country_of_origin" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "country_of_residence" text;--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "regional_profile";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "bowl_size_ml";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "plate_size_ml";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "hand_span_cm";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "knuckle_depth_cm";--> statement-breakpoint
UPDATE "user_profiles" SET "onboarding_step" = 3 WHERE "onboarding_step" > 3;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_onboarding_step_check" CHECK ("user_profiles"."onboarding_step" >= 0 AND "user_profiles"."onboarding_step" <= 3);