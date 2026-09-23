-- KALLO-05: every avatar write goes through the server's decode/re-encode.
--
-- 20260719145843 let an `authenticated` JWT INSERT/DELETE/SELECT objects under
-- its own `{user_id}/` prefix. That made the API route's validation optional:
-- an owner could PUT straight to `/storage/v1/object/avatars/{uid}/…` with
-- any bytes that claimed `image/webp` (the pentest parked AVIF bytes that
-- way), skipping the magic-byte check and the sharp re-encode entirely.
--
-- The route now uploads and removes with the service-role client, strictly
-- after `processAvatarImage` and with a server-built `{uid}/{uuid}.webp` path,
-- so users need NO storage policy on this bucket at all:
--   * insert — the bypass itself; nothing legitimate uses it any more.
--   * delete — replace/remove cleanup runs as service role (prefix-checked in
--     `lib/actions/groups/avatar.ts`); account deletion already did.
--   * select — only existed so the user-JWT `remove()` could see its own rows;
--     public reads go through `/object/public/…`, which never consults RLS.
--   * update — never created, dropped defensively so an out-of-band dashboard
--     policy can't reopen upsert-overwrite.
-- With no policy, RLS on `storage.objects` denies every user-JWT write, list
-- and delete in this bucket. The bucket stays PUBLIC (owner decision: avatars
-- render on the anonymous invite page and in feeds).
--
-- Bucket limits stay as the storage-side backstop and are unchanged: the
-- worst legitimate re-encode (512px WebP of full-entropy RGBA noise at q82)
-- measures ~375 KB, so the existing 500 KB cap is already close to the real
-- processed maximum — tightening it further would reject valid uploads.
--
-- Journaled like 20260719145843 so both apply paths run it: `bun db:migrate`
-- (drizzle-kit, journal-driven) and `bun dbr:push` (supabase, filename-
-- ordered). DROP … IF EXISTS keeps it idempotent across a migration repair.
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;
