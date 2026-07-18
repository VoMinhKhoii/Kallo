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
-- MIME allowlist here keeps a spoofed Content-Type inside image/* (never
-- text/html or image/svg+xml), so a smuggled object can't execute in a
-- browser. DO UPDATE so re-runs upgrade an existing bucket's limits.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
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
	);
