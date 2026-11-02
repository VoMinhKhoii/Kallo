CREATE TABLE "friend_removals" (
	"remover_id" uuid NOT NULL,
	"removed_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_removals_remover_id_removed_id_pk" PRIMARY KEY("remover_id","removed_id"),
	CONSTRAINT "friend_removals_not_self_check" CHECK ("friend_removals"."remover_id" <> "friend_removals"."removed_id")
);
--> statement-breakpoint
CREATE TABLE "released_handles" (
	"handle" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"released_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "friend_removals" ADD CONSTRAINT "friend_removals_remover_id_users_id_fk" FOREIGN KEY ("remover_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_removals" ADD CONSTRAINT "friend_removals_removed_id_users_id_fk" FOREIGN KEY ("removed_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friend_removals_removed_id_idx" ON "friend_removals" USING btree ("removed_id");--> statement-breakpoint
CREATE INDEX "released_handles_user_id_idx" ON "released_handles" USING btree ("user_id");