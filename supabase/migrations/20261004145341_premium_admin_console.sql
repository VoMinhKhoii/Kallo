CREATE TABLE "premium_settings" (
	"id" smallint PRIMARY KEY NOT NULL,
	"welcome_enabled" boolean DEFAULT true NOT NULL,
	"welcome_days" integer DEFAULT 14 NOT NULL,
	"welcome_auto_off_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_email" text,
	CONSTRAINT "premium_settings_singleton_check" CHECK ("premium_settings"."id" = 1),
	CONSTRAINT "premium_settings_welcome_days_check" CHECK ("premium_settings"."welcome_days" BETWEEN 1 AND 365)
);
--> statement-breakpoint
ALTER TABLE "premium_grant_audit" DROP CONSTRAINT "premium_grant_audit_scope_check";--> statement-breakpoint
ALTER TABLE "premium_grant_audit" DROP CONSTRAINT "premium_grant_audit_days_check";--> statement-breakpoint
ALTER TABLE "premium_grant_audit" ALTER COLUMN "days" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "premium_grant_audit" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entitlement_grants" ADD COLUMN "canceled_by_action" uuid;--> statement-breakpoint
ALTER TABLE "premium_grant_audit" ADD COLUMN "action" text DEFAULT 'grant' NOT NULL;--> statement-breakpoint
ALTER TABLE "premium_grant_audit" ADD COLUMN "mode" text;--> statement-breakpoint
ALTER TABLE "premium_grant_audit" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "premium_grant_audit" ADD COLUMN "details" jsonb;--> statement-breakpoint
ALTER TABLE "premium_grant_audit" ADD COLUMN "undone_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "premium_grant_audit" ADD COLUMN "undone_by_email" text;--> statement-breakpoint
ALTER TABLE "premium_grant_audit" ADD CONSTRAINT "premium_grant_audit_action_check" CHECK ("premium_grant_audit"."action" IN ('grant', 'end', 'offer', 'undo'));--> statement-breakpoint
ALTER TABLE "premium_grant_audit" ADD CONSTRAINT "premium_grant_audit_mode_check" CHECK ("premium_grant_audit"."mode" IS NULL OR "premium_grant_audit"."mode" IN ('extend', 'restart'));--> statement-breakpoint
ALTER TABLE "premium_grant_audit" ADD CONSTRAINT "premium_grant_audit_scope_check" CHECK ("premium_grant_audit"."scope" IN ('users', 'group', 'everyone', 'offer'));--> statement-breakpoint
ALTER TABLE "premium_grant_audit" ADD CONSTRAINT "premium_grant_audit_days_check" CHECK ("premium_grant_audit"."days" IS NULL OR "premium_grant_audit"."days" BETWEEN 1 AND 365);--> statement-breakpoint
-- Security boundary: the welcome-offer settings are server-only. Deny-by-default
-- lives in the creating migration so a later failure can never leave it open.
ALTER TABLE public.premium_settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE public.premium_settings FROM anon, authenticated;
