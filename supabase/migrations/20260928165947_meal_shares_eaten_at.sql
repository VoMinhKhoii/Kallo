ALTER TABLE "meal_shares" ADD COLUMN "eaten_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "meal_shares_eaten_at_id_idx" ON "meal_shares" USING btree ("eaten_at" DESC,"id" DESC) WHERE visibility <> 'private';--> statement-breakpoint
CREATE INDEX "meal_shares_actor_eaten_at_id_idx" ON "meal_shares" USING btree ("actor_id","eaten_at" DESC,"id" DESC) WHERE visibility <> 'private';