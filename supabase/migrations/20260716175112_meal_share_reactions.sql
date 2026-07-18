CREATE TABLE "meal_share_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text DEFAULT 'yum' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_share_reactions_share_user_uniq" UNIQUE("share_id","user_id"),
	CONSTRAINT "meal_share_reactions_kind_check" CHECK ("meal_share_reactions"."kind" IN ('yum', 'cheer', 'strong', 'wow', 'heart'))
);
--> statement-breakpoint
ALTER TABLE "meal_share_reactions" ADD CONSTRAINT "meal_share_reactions_share_id_meal_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."meal_shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_share_reactions" ADD CONSTRAINT "meal_share_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_share_reactions_share_idx" ON "meal_share_reactions" USING btree ("share_id");