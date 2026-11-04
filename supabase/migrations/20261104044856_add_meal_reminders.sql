-- =============================================================================
-- Domain A (Drizzle-generated) — meal reminders
--
-- `meal_reminders` (the per-user, per-local-day reminder log), plus three
-- columns the reminder tick reads: user_profiles.meal_reminders_enabled (the
-- one Settings switch, default on), user_profiles.time_zone (the IANA zone the
-- iOS app reports) and push_tokens.last_pushed_at (the 30-minute spacing
-- gate). docs/NOTIFICATIONS.md → "Reminders".
--
-- The trailing ENABLE ROW LEVEL SECURITY / REVOKE / GRANT block is the narrow
-- failure-boundary exception documented in docs/DATABASE.md § "Domain B":
-- the log is server-only, and if a follow-up migration failed to apply the
-- table would otherwise sit client-readable through the anon key.
-- =============================================================================

CREATE TABLE "meal_reminders" (
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"checkpoint_hour" smallint NOT NULL,
	"outcome" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_reminders_user_id_local_date_checkpoint_hour_pk" PRIMARY KEY("user_id","local_date","checkpoint_hour"),
	CONSTRAINT "meal_reminders_checkpoint_hour_check" CHECK ("meal_reminders"."checkpoint_hour" IN (8, 10, 15, 21)),
	CONSTRAINT "meal_reminders_outcome_check" CHECK ("meal_reminders"."outcome" IN ('sent', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "push_tokens" ADD COLUMN "last_pushed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "meal_reminders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "meal_reminders" ADD CONSTRAINT "meal_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "meal_reminders" FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "meal_reminders" TO service_role;
