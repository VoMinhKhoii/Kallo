ALTER TABLE "public_profiles" ADD COLUMN "avatar_path" text;--> statement-breakpoint

-- Public storage bucket for profile avatar photos. Objects are namespaced by
-- owner: `{user_id}/{uuid}.{ext}` (uuid filename doubles as cache-busting on
-- replace). The bucket is PUBLIC because avatars render on the anonymous
-- invite page (/invite/[slug]) and in friend feeds on web + mobile — paths are
-- unguessable and listing is not exposed. Writes stay owner-scoped via RLS.
-- Bucket + policies live in THIS journaled migration (not a separate file) so
-- both apply paths run them: `bun db:migrate` (drizzle-kit, journal-driven)
-- and `bun dbr:push` (supabase, filename-ordered). Policy creates use
-- DROP … IF EXISTS first so they survive a `supabase migration repair` re-run.
-- Bucket-level size/MIME caps are the storage-side trust boundary: the RLS
-- policy below authorizes direct Storage uploads with a user JWT (bypassing
-- the API route's validation), so the bucket itself must reject oversized or
-- non-image objects. Magic-byte sniffing still happens in the route; the
-- MIME allowlist is webp-only: the API route re-encodes every accepted
-- upload (png/jpeg/webp in) to WebP before storing, so nothing else ever
-- legitimately lands here — and a smuggled object can't claim text/html or
-- image/svg+xml. DO UPDATE so re-runs upgrade an existing bucket's limits.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE SET
	public = EXCLUDED.public,
	file_size_limit = EXCLUDED.file_size_limit,
	allowed_mime_types = EXCLUDED.allowed_mime_types;--> statement-breakpoint
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;--> statement-breakpoint
CREATE POLICY "avatars_insert_own"
	ON storage.objects
	FOR INSERT TO authenticated
	WITH CHECK (
		bucket_id = 'avatars'
		AND (storage.foldername(name))[1] = auth.uid()::text
	);--> statement-breakpoint
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;--> statement-breakpoint
CREATE POLICY "avatars_delete_own"
	ON storage.objects
	FOR DELETE TO authenticated
	USING (
		bucket_id = 'avatars'
		AND (storage.foldername(name))[1] = auth.uid()::text
	);--> statement-breakpoint
-- SELECT is required for the storage remove/list APIs even on a public bucket
-- (public only bypasses RLS for the unauthenticated object endpoint) — without
-- it every replace/remove silently 403s and old photos stay live forever.
DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;--> statement-breakpoint
CREATE POLICY "avatars_select_own"
	ON storage.objects
	FOR SELECT TO authenticated
	USING (
		bucket_id = 'avatars'
		AND (storage.foldername(name))[1] = auth.uid()::text
	);
