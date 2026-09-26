CREATE TABLE "apple_auth_tokens" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"refresh_token_ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apple_token_revocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_ciphertext" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "apple_token_revocations_status_check" CHECK ("apple_token_revocations"."status" IN ('pending', 'completed', 'dead'))
);
--> statement-breakpoint
ALTER TABLE "apple_auth_tokens" ADD CONSTRAINT "apple_auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "apple_token_revocations_pending_user_idx" ON "apple_token_revocations" USING btree ("user_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "apple_token_revocations_due_idx" ON "apple_token_revocations" USING btree ("next_attempt_at") WHERE status = 'pending';