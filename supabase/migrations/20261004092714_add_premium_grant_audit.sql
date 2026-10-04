CREATE TABLE "premium_grant_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"admin_email" text NOT NULL,
	"scope" text NOT NULL,
	"days" integer NOT NULL,
	"user_count" integer NOT NULL,
	"target_user_ids" uuid[],
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "premium_grant_audit_scope_check" CHECK ("premium_grant_audit"."scope" IN ('users', 'everyone')),
	CONSTRAINT "premium_grant_audit_days_check" CHECK ("premium_grant_audit"."days" BETWEEN 1 AND 365)
);
--> statement-breakpoint
CREATE INDEX "premium_grant_audit_created_at_idx" ON "premium_grant_audit" USING btree ("created_at");--> statement-breakpoint
-- Security boundary: the audit trail is server-only. Deny-by-default lives in
-- the creating migration so a later failure can never leave it client-readable.
ALTER TABLE public.premium_grant_audit ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE public.premium_grant_audit FROM anon, authenticated;
