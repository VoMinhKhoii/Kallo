CREATE INDEX "friendships_user_high_idx" ON "friendships" USING btree ("user_high");--> statement-breakpoint
CREATE INDEX "meal_shares_shared_at_idx" ON "meal_shares" USING btree ("shared_at" DESC) WHERE visibility <> 'private';--> statement-breakpoint
CREATE INDEX "meal_shares_actor_idx" ON "meal_shares" USING btree ("actor_id");