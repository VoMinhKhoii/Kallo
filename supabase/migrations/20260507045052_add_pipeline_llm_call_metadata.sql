CREATE TABLE "pipeline_llm_call_metadata" (
	"llm_call_id" uuid PRIMARY KEY NOT NULL,
	"provider" text,
	"region" text,
	"cache_status" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_tokens" integer,
	"thought_tokens" integer,
	"prompt_chars" integer,
	"schema_chars" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pipeline_llm_call_metadata" ADD CONSTRAINT "pipeline_llm_call_metadata_llm_call_id_pipeline_llm_calls_id_fk" FOREIGN KEY ("llm_call_id") REFERENCES "public"."pipeline_llm_calls"("id") ON DELETE cascade ON UPDATE no action;