-- =============================================================================
-- Domain B (hand-authored): retire the Supabase Storage policies.
--
-- #416 (2026-10-08) moved every uploaded file (avatars, feedback screenshots,
-- kept nutrition-label photos) to Cloudflare R2 (docs/STORAGE.md). The app no
-- longer reads or writes Supabase Storage, and the one-week rollback window,
-- during which deletes were mirrored to the old buckets, is over. This drops
-- the `storage.objects` policies those buckets still carried, so no user JWT
-- can reach them while they wait to be emptied.
--
-- The buckets themselves are NOT dropped here: Supabase forbids direct deletes
-- on `storage.buckets` / `storage.objects`. The owner empties and deletes them
-- through the Storage API with `scripts/ops/delete-supabase-storage-buckets.ts`
-- after this migration is applied.
--
-- Journaled like 20260923034000 and 20260925123100 so both apply paths run it:
-- `bun db:migrate` (drizzle-kit, journal-driven) and `bun dbr:push` (supabase,
-- filename-ordered). Every name is dropped IF EXISTS — including the avatar
-- and nutrition-label write policies earlier migrations already dropped — so
-- it is idempotent across a repair.
-- =============================================================================

DROP POLICY IF EXISTS "feedback_screenshots_insert_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "feedback_screenshots_select_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "nutrition_labels_select_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "nutrition_labels_insert_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "nutrition_labels_update_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "nutrition_labels_delete_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;
