CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"actor_count" integer DEFAULT 1 NOT NULL,
	"object_type" text,
	"object_id" uuid,
	"target_type" text,
	"target_id" uuid,
	"group_key" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" IN ('friend.joined', 'group.added', 'share.invite', 'share.invite_accepted', 'share.reaction', 'share.reply', 'share.logged', 'chat.message', 'coach.nudge', 'streak.milestone', 'recap.ready'))
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_id","created_at" DESC,"id" DESC) WHERE dismissed_at IS NULL;--> statement-breakpoint
CREATE INDEX "notifications_recipient_unseen_idx" ON "notifications" USING btree ("recipient_id") WHERE seen_at IS NULL AND dismissed_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_open_aggregate_idx" ON "notifications" USING btree ("recipient_id","group_key") WHERE read_at IS NULL AND dismissed_at IS NULL;