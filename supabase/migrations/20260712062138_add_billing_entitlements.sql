CREATE TABLE "billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"user_id" uuid,
	"raw_payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_webhook_events_source_event_unique" UNIQUE("source","external_event_id"),
	CONSTRAINT "billing_webhook_events_source_check" CHECK ("billing_webhook_events"."source" IN ('revenuecat', 'polar', 'payos'))
);
--> statement-breakpoint
CREATE TABLE "entitlement_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entitlement_key" text NOT NULL,
	"source" text NOT NULL,
	"product_id" text,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"will_renew" boolean DEFAULT false NOT NULL,
	"external_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlement_grants_source_external_ref_unique" UNIQUE("source","external_ref"),
	CONSTRAINT "entitlement_grants_source_check" CHECK ("entitlement_grants"."source" IN ('revenuecat', 'polar', 'payos', 'promo')),
	CONSTRAINT "entitlement_grants_status_check" CHECK ("entitlement_grants"."status" IN ('active', 'canceled', 'expired', 'refunded'))
);
--> statement-breakpoint
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_webhook_events_user_idx" ON "billing_webhook_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_webhook_events_created_idx" ON "billing_webhook_events" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "entitlement_grants_user_status_idx" ON "entitlement_grants" USING btree ("user_id","status");--> statement-breakpoint

-- Billing entitlements: source of truth for premium access. The Drizzle DDL
-- above lands the two tables; the hand-authored blocks below add the
-- updated_at trigger + RLS (drizzle-kit does not emit triggers/RLS/policies).
-- Kept in THIS journaled migration so both apply paths run them: `bun db:migrate`
-- (drizzle-kit, journal-driven) and `bun dbr:push` (supabase, filename-ordered).
-- DROP … IF EXISTS first so the statements survive a `supabase migration repair`
-- re-run.

-- Keep updated_at fresh on every UPDATE (webhook renewals/cancellations),
-- matching every other updated_at table in the repo. The function ships in
-- 20260228155945.
DROP TRIGGER IF EXISTS "on_entitlement_grants_updated" ON "entitlement_grants";--> statement-breakpoint
CREATE TRIGGER "on_entitlement_grants_updated"
	BEFORE UPDATE ON "entitlement_grants"
	FOR EACH ROW
	EXECUTE FUNCTION public.handle_updated_at();--> statement-breakpoint

-- Row-level security on entitlement_grants: authenticated users may read ONLY
-- their own grants (the derived entitlements view is served from these rows).
-- All writes go through the server's postgres role (RevenueCat webhook +
-- admin/promo tooling), which bypasses RLS — so there is deliberately no
-- insert/update/delete policy.
ALTER TABLE "entitlement_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "entitlement_grants_select_own" ON "entitlement_grants";--> statement-breakpoint
CREATE POLICY "entitlement_grants_select_own" ON "entitlement_grants"
	FOR SELECT TO authenticated
	USING (auth.uid() = user_id);--> statement-breakpoint

-- Row-level security on billing_webhook_events: raw provider payloads are
-- server-only. RLS is enabled with NO policies, so the anon/authed client can
-- neither read nor write; only the service-role/postgres server path (which
-- bypasses RLS) touches this table.
ALTER TABLE "billing_webhook_events" ENABLE ROW LEVEL SECURITY;