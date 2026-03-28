# T02: 01-database-schema-infrastructure 02

**Slice:** S01 — **Milestone:** M001

## Description

Enable pgvector, add embedding column to vietnamese_food_composition, create HNSW index, build the match_ingredients search function, and generate embeddings for all existing rows.

Purpose: Semantic ingredient matching is the core of the AI pipeline — it handles Vietnamese synonyms (thịt ba chỉ/ba rọi/thịt mỡ), misspellings, and LLM extraction errors via vector similarity instead of exact text matching. Without this, Phase 3 (AI Pipeline) cannot ground its outputs.

Output: One raw SQL migration file (Domain B — not Drizzle-managed) that sets up the complete pgvector infrastructure.

## Must-Haves

- [ ] "pgvector extension is enabled in the database"
- [ ] "Each food composition row has a vector embedding derived from its Vietnamese and English names"
- [ ] "A semantic similarity query returns correct matches for Vietnamese synonym inputs (e.g., 'ba rọi' matches 'Thịt lợn ba chỉ')"
- [ ] "An HNSW index accelerates vector similarity searches"
- [ ] "A match_ingredients SQL function returns top-N candidates by cosine similarity"

## Files

- `supabase/migrations/_pgvector_embeddings.sql`
