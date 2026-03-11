ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_broth_consumption_check";--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "onboarding_step" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_hand_span_cm_check" CHECK ("user_profiles"."hand_span_cm" > 0);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_knuckle_depth_cm_check" CHECK ("user_profiles"."knuckle_depth_cm" > 0);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_broth_consumption_check" CHECK ("user_profiles"."broth_consumption" IN ('leave_it', 'some', 'finish_it'));