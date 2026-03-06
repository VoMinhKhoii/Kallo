ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_aggression_check";--> statement-breakpoint
UPDATE "user_profiles" SET "aggression" = CASE
  WHEN "aggression" = 'gentle' THEN '0.3'
  WHEN "aggression" = 'moderate' THEN '0.5'
  WHEN "aggression" = 'aggressive' THEN '0.8'
  ELSE NULL
END WHERE "aggression" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "aggression" SET DATA TYPE numeric(2, 1);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_aggression_check" CHECK ("user_profiles"."aggression" >= 0.1 AND "user_profiles"."aggression" <= 0.8);