CREATE INDEX "chat_group_messages_sender_idx" ON "chat_group_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "meal_share_invites_from_user_idx" ON "meal_share_invites" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "meal_share_invites_to_user_idx" ON "meal_share_invites" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "meal_share_reactions_user_idx" ON "meal_share_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meal_share_replies_user_idx" ON "meal_share_replies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "product_telemetry_events_user_occurred_at_idx" ON "product_telemetry_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "unmatched_ingredients_user_idx" ON "unmatched_ingredients" USING btree ("user_id");