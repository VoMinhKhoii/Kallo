SET search_path TO public, extensions;

CREATE TABLE "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id_hash" text NOT NULL,
	"request_id" text,
	"model_call1" text NOT NULL,
	"model_call2" text NOT NULL,
	"escalated" boolean DEFAULT false NOT NULL,
	"cache_hit_l4" boolean DEFAULT false NOT NULL,
	"retry_count" smallint DEFAULT 0 NOT NULL,
	"total_ms" integer DEFAULT 0 NOT NULL,
	"ingredient_count" smallint DEFAULT 0 NOT NULL,
	"matched_count" smallint DEFAULT 0 NOT NULL,
	"unmatched_count" smallint DEFAULT 0 NOT NULL,
	"anomaly_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"pre_match_alias_hits" smallint DEFAULT 0 NOT NULL,
	"cooked_to_raw_factor_fires" smallint DEFAULT 0 NOT NULL,
	"density_envelope_fires" smallint DEFAULT 0 NOT NULL,
	"macro_inconsistent_fires" smallint DEFAULT 0 NOT NULL,
	"db_state_unknown_fires" smallint DEFAULT 0 NOT NULL,
	"retry_step2_count" smallint DEFAULT 0 NOT NULL,
	"prompt_personalization_fields" text[] DEFAULT '{}'::text[] NOT NULL
);
