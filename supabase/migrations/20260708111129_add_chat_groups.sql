CREATE TABLE "chat_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_group_members_group_user_uniq" UNIQUE("group_id","user_id"),
	CONSTRAINT "chat_group_members_role_check" CHECK ("chat_group_members"."role" IN ('owner', 'member'))
);
--> statement-breakpoint
CREATE TABLE "chat_group_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"name" text,
	"created_by" uuid NOT NULL,
	"direct_user_low" uuid,
	"direct_user_high" uuid,
	"avatar_seed" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_groups_direct_pair_uniq" UNIQUE("direct_user_low","direct_user_high"),
	CONSTRAINT "chat_groups_kind_check" CHECK ("chat_groups"."kind" IN ('direct', 'group')),
	CONSTRAINT "chat_groups_direct_shape_check" CHECK (("chat_groups"."kind" = 'direct' AND "chat_groups"."direct_user_low" IS NOT NULL AND "chat_groups"."direct_user_high" IS NOT NULL AND "chat_groups"."direct_user_low" < "chat_groups"."direct_user_high")
          OR ("chat_groups"."kind" = 'group' AND "chat_groups"."direct_user_low" IS NULL AND "chat_groups"."direct_user_high" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "chat_group_members" ADD CONSTRAINT "chat_group_members_group_id_chat_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_group_members" ADD CONSTRAINT "chat_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_group_messages" ADD CONSTRAINT "chat_group_messages_group_id_chat_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_group_messages" ADD CONSTRAINT "chat_group_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_groups" ADD CONSTRAINT "chat_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_groups" ADD CONSTRAINT "chat_groups_direct_user_low_users_id_fk" FOREIGN KEY ("direct_user_low") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_groups" ADD CONSTRAINT "chat_groups_direct_user_high_users_id_fk" FOREIGN KEY ("direct_user_high") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_group_members_user_idx" ON "chat_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_group_members_group_idx" ON "chat_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "chat_group_messages_group_created_idx" ON "chat_group_messages" USING btree ("group_id","created_at" DESC);