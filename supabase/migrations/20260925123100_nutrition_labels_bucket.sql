-- =============================================================================
-- Domain B (hand-authored): the private `nutrition-labels` bucket, its storage
-- policies, and RLS for nutrition_label_images.
--
-- The table itself is Domain A (drizzle-kit, 20260925123000). This file owns
-- the bucket and the policies and must never be overwritten by
-- `drizzle-kit generate`.
--
-- Product decision: every label photo the scanner sends to the model is KEPT,
-- with the scan's outcome (the extraction or the failure code, and later the
-- values the user saved) in nutrition_label_images, for two readers only — the
-- owner (to view it again later) and the Kallo team (OCR QA/eval, through the
-- service role). No other user can ever read one. It is retained until the
-- account is deleted; there is no time-based purge.
--
-- Writes are server-only, mirroring the avatar hardening in
-- 20260923034000_avatars_server_only_writes.sql: the scan route uploads with
-- the service-role client strictly after `validateNutritionLabelImage`, to a
-- server-built `{user_id}/{uuid}.{ext}` path, and account deletion removes the
-- objects the same way. So there is NO insert, update or delete policy on this
-- bucket: with none, RLS on `storage.objects` denies every user-JWT write. The
-- UPDATE/DELETE/INSERT names are dropped defensively so an out-of-band
-- dashboard policy can't reopen a client write path.
--
-- The owner SELECT policy is what lets the owner's own JWT read their prefix.
-- The app itself serves the owner a short-lived signed URL from
-- GET /api/v1/nutrition-label/images/{imageId} (service role, ownership
-- checked on the row first); the policy keeps a direct owner read possible
-- and never exposes another user's prefix.
--
-- Bucket limits are the storage-side backstop and match the OCR validator
-- (`lib/domain/nutrition/ocr/image-constants.ts`): 4 MiB and JPEG/PNG/WebP.
--
-- Journaled like 20260923034000 so both apply paths run it: `bun db:migrate`
-- (drizzle-kit, journal-driven) and `bun dbr:push` (supabase, filename-
-- ordered). IF EXISTS / ON CONFLICT keep it idempotent across a repair.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
	'nutrition-labels',
	'nutrition-labels',
	false,
	4194304,
	ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
	public = EXCLUDED.public,
	file_size_limit = EXCLUDED.file_size_limit,
	allowed_mime_types = EXCLUDED.allowed_mime_types;--> statement-breakpoint

DROP POLICY IF EXISTS "nutrition_labels_insert_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "nutrition_labels_update_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "nutrition_labels_delete_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "nutrition_labels_select_own" ON storage.objects;--> statement-breakpoint
CREATE POLICY "nutrition_labels_select_own"
	ON storage.objects
	FOR SELECT TO authenticated
	USING (
		bucket_id = 'nutrition-labels'
		AND (storage.foldername(name))[1] = auth.uid()::text
	);--> statement-breakpoint

-- The table: owner SELECT only, no client writes. The PostgREST data plane is
-- already locked (20260825120000 revokes table grants from anon/authenticated,
-- including by default privilege), so today every read goes through the
-- server's Drizzle connection with an explicit user_id predicate; the policy
-- is the backstop should a grant ever return.
ALTER TABLE public.nutrition_label_images ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Users can view own nutrition label images" ON public.nutrition_label_images;--> statement-breakpoint
CREATE POLICY "Users can view own nutrition label images"
	ON public.nutrition_label_images FOR SELECT TO authenticated
	USING (auth.uid() = user_id);
