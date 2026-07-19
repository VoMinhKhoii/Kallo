DROP INDEX "chat_group_members_group_idx";--> statement-breakpoint
DROP INDEX "meal_share_reactions_share_idx";--> statement-breakpoint
DROP INDEX "meal_share_replies_share_idx";--> statement-breakpoint
CREATE INDEX "meal_share_replies_share_created_id_idx" ON "meal_share_replies" USING btree ("share_id","created_at","id");--> statement-breakpoint
CREATE INDEX "meal_shares_actor_shared_at_id_idx" ON "meal_shares" USING btree ("actor_id","shared_at" DESC,"id" DESC) WHERE visibility <> 'private';