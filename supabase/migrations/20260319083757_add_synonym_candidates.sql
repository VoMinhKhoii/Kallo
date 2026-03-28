CREATE TABLE "synonym_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"queried_vi" text NOT NULL,
	"matched_en" text NOT NULL,
	"matched_vi" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed" boolean DEFAULT false NOT NULL
);
