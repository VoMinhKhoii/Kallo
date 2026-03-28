SET search_path TO public, extensions;

CREATE TABLE "ingredient_query_embeddings" (
	"name_vi" text PRIMARY KEY NOT NULL,
	"name_en" text,
	"embedding" vector(768) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
