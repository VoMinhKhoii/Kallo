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
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint
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
