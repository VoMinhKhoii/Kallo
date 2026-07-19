CREATE TABLE "meal_share_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_share_replies" ADD CONSTRAINT "meal_share_replies_share_id_meal_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."meal_shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_share_replies" ADD CONSTRAINT "meal_share_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_share_replies_share_idx" ON "meal_share_replies" USING btree ("share_id");