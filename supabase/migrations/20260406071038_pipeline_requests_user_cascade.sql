ALTER TABLE "pipeline_requests" DROP CONSTRAINT "pipeline_requests_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD CONSTRAINT "pipeline_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;