CREATE TABLE "meal_share_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_meal_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"portion_factor" numeric DEFAULT '1' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"accepted_meal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "meal_share_invites_meal_recipient_uniq" UNIQUE("source_meal_id","to_user_id"),
	CONSTRAINT "meal_share_invites_mode_check" CHECK ("meal_share_invites"."mode" IN ('copy', 'split')),
	CONSTRAINT "meal_share_invites_status_check" CHECK ("meal_share_invites"."status" IN ('pending', 'accepted', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "meal_share_invites" ADD CONSTRAINT "meal_share_invites_source_meal_id_meals_id_fk" FOREIGN KEY ("source_meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_share_invites" ADD CONSTRAINT "meal_share_invites_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_share_invites" ADD CONSTRAINT "meal_share_invites_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_share_invites" ADD CONSTRAINT "meal_share_invites_accepted_meal_id_meals_id_fk" FOREIGN KEY ("accepted_meal_id") REFERENCES "public"."meals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_share_invites_recipient_status_idx" ON "meal_share_invites" USING btree ("to_user_id","created_at" DESC) WHERE status = 'pending';
