CREATE TABLE "billing_provider_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"environment" text NOT NULL,
	"provider_synced_at" timestamp with time zone NOT NULL,
	"ownership_event_at" timestamp with time zone,
	"ownership_event_id" text,
	"ownership_event_priority" integer DEFAULT 0 NOT NULL,
	"ownership_revoked" boolean DEFAULT false NOT NULL,
	"customer_missing_since" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_provider_syncs_user_source_unique" UNIQUE("user_id","source","environment"),
	CONSTRAINT "billing_provider_syncs_source_check" CHECK ("billing_provider_syncs"."source" IN ('revenuecat', 'polar', 'payos')),
	CONSTRAINT "billing_provider_syncs_environment_check" CHECK ("billing_provider_syncs"."environment" IN ('production', 'sandbox'))
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"user_id" uuid,
	"raw_payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"event_timestamp" timestamp with time zone,
	"environment" text,
	"deployment_environment" text NOT NULL,
	"provider_app_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"dead_lettered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_webhook_events_source_event_unique" UNIQUE("source","external_event_id","deployment_environment"),
	CONSTRAINT "billing_webhook_events_source_check" CHECK ("billing_webhook_events"."source" IN ('revenuecat', 'polar', 'payos')),
	CONSTRAINT "billing_webhook_events_deployment_environment_check" CHECK ("billing_webhook_events"."deployment_environment" IN ('production', 'sandbox'))
);
--> statement-breakpoint
CREATE TABLE "entitlement_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entitlement_key" text NOT NULL,
	"source" text NOT NULL,
	"environment" text NOT NULL,
	"store" text,
	"product_id" text,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"will_renew" boolean DEFAULT false NOT NULL,
	"external_ref" text NOT NULL,
	"provider_synced_at" timestamp with time zone,
	"management_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlement_grants_source_external_ref_unique" UNIQUE("source","external_ref","environment"),
	CONSTRAINT "entitlement_grants_source_check" CHECK ("entitlement_grants"."source" IN ('revenuecat', 'polar', 'payos', 'promo')),
	CONSTRAINT "entitlement_grants_environment_check" CHECK ("entitlement_grants"."environment" IN ('production', 'sandbox')),
	CONSTRAINT "entitlement_grants_status_check" CHECK ("entitlement_grants"."status" IN ('active', 'canceled', 'expired', 'refunded'))
);
--> statement-breakpoint
ALTER TABLE "billing_provider_syncs" ADD CONSTRAINT "billing_provider_syncs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_webhook_events_user_idx" ON "billing_webhook_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_webhook_events_created_idx" ON "billing_webhook_events" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "billing_webhook_events_pending_idx" ON "billing_webhook_events" USING btree ("source","deployment_environment","next_attempt_at","created_at") WHERE "billing_webhook_events"."processed_at" IS NULL AND "billing_webhook_events"."dead_lettered_at" IS NULL;--> statement-breakpoint
CREATE INDEX "entitlement_grants_user_status_idx" ON "entitlement_grants" USING btree ("user_id","status");
--> statement-breakpoint
-- Security boundary: billing state is server-derived. These deny-by-default
-- controls live in the table-creation migration so a later migration failure
-- can never leave provider watermarks or grants client-writable.
ALTER TABLE public.entitlement_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_provider_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.entitlement_grants FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_provider_syncs FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_webhook_events FROM anon, authenticated;
