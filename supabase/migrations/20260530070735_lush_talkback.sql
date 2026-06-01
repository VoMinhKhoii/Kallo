CREATE TABLE "circle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"audience" uuid,
	"type" text NOT NULL,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circle_events_type_check" CHECK ("circle_events"."type" IN ('meal_shared', 'friend_request', 'friend_accepted', 'coach_nudge', 'streak_milestone', 'recap_ready'))
);
--> statement-breakpoint
CREATE TABLE "coach_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"rank" text DEFAULT 'primary' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"audience_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_assignments_rank_check" CHECK ("coach_assignments"."rank" IN ('primary', 'secondary')),
	CONSTRAINT "coach_assignments_status_check" CHECK ("coach_assignments"."status" IN ('pending', 'active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_low" uuid NOT NULL,
	"user_high" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_user_low_high_uniq" UNIQUE("user_low","user_high"),
	CONSTRAINT "friendships_user_order_check" CHECK ("friendships"."user_low" < "friendships"."user_high"),
	CONSTRAINT "friendships_status_check" CHECK ("friendships"."status" IN ('pending', 'accepted', 'blocked'))
);
--> statement-breakpoint
CREATE TABLE "meal_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"shared_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_shares_meal_id_uniq" UNIQUE("meal_id"),
	CONSTRAINT "meal_shares_visibility_check" CHECK ("meal_shares"."visibility" IN ('private', 'circle', 'public'))
);
--> statement-breakpoint
CREATE TABLE "public_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"avatar_seed" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_profiles_handle_uniq" UNIQUE("handle")
);
--> statement-breakpoint
ALTER TABLE "circle_events" ADD CONSTRAINT "circle_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_assignments" ADD CONSTRAINT "coach_assignments_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_assignments" ADD CONSTRAINT "coach_assignments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_low_users_id_fk" FOREIGN KEY ("user_low") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_high_users_id_fk" FOREIGN KEY ("user_high") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_shares" ADD CONSTRAINT "meal_shares_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_shares" ADD CONSTRAINT "meal_shares_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_profiles" ADD CONSTRAINT "public_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circle_events_audience_created_idx" ON "circle_events" USING btree ("audience","created_at" DESC);--> statement-breakpoint
CREATE INDEX "circle_events_actor_created_idx" ON "circle_events" USING btree ("actor_id","created_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "coach_assignments_one_active_primary_idx" ON "coach_assignments" USING btree ("client_id") WHERE rank = 'primary' AND status = 'active';