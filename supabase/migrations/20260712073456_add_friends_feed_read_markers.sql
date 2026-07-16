CREATE TABLE "friends_feed_read_markers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "friends_feed_read_markers" ADD CONSTRAINT "friends_feed_read_markers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;