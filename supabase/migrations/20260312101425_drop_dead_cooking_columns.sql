ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_fat_trim_pork_check";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_fat_trim_chicken_check";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_fat_trim_fish_check";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "fat_trim_pork";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "fat_trim_chicken";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "fat_trim_fish";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "bone_awareness";