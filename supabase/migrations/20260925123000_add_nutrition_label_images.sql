CREATE TABLE "nutrition_label_images" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"status" text NOT NULL,
	"result" jsonb,
	"error_code" text,
	"model" text,
	"latency_ms" integer,
	"meal_id" uuid,
	"reviewed_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nutrition_label_images_storage_path_unique" UNIQUE("storage_path"),
	CONSTRAINT "nutrition_label_images_status_check" CHECK ("nutrition_label_images"."status" IN ('succeeded', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "nutrition_label_images" ADD CONSTRAINT "nutrition_label_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_label_images" ADD CONSTRAINT "nutrition_label_images_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nutrition_label_images_user_created_idx" ON "nutrition_label_images" USING btree ("user_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "nutrition_label_images_meal_idx" ON "nutrition_label_images" USING btree ("meal_id");