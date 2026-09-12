CREATE TABLE "day_completion_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_completion_marks_user_date_uniq" UNIQUE("user_id","local_date")
);
--> statement-breakpoint
ALTER TABLE "day_completion_marks" ADD CONSTRAINT "day_completion_marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;