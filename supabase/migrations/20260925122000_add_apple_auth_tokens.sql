CREATE TABLE "apple_auth_tokens" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"refresh_token_ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apple_auth_tokens" ADD CONSTRAINT "apple_auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;