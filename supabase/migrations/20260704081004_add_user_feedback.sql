-- In-app user feedback: bug reports, ingredient/food requests, and ideas
-- submitted from web + mobile and triaged by admins at /admin/feedback.
-- Row-level isolation is enforced in the server action (user_id is set from
-- the authed session, never the request body); RLS below is defense-in-depth
-- for the browser/mobile supabase client path.
--
-- The storage bucket + policies + updated_at trigger live in THIS journaled
-- migration (not a separate file) so both apply paths run them: `bun db:migrate`
-- (drizzle-kit, journal-driven — skips non-journal SQL) and `bun dbr:push`
-- (supabase, filename-ordered). Policy creates use DROP … IF EXISTS first so
-- the policy statements survive a `supabase migration repair` re-run.
CREATE TABLE "user_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"screenshot_path" text,
	"app_version" text,
	"platform" text,
	"locale" text,
	"route" text,
	"metadata" jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_feedback_type_check" CHECK ("user_feedback"."type" IN ('bug', 'ingredient', 'idea')),
	CONSTRAINT "user_feedback_platform_check" CHECK ("user_feedback"."platform" IN ('web', 'ios', 'android')),
	CONSTRAINT "user_feedback_status_check" CHECK ("user_feedback"."status" IN ('open', 'triaged', 'resolved', 'wontfix'))
);
--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_feedback_status_created_idx" ON "user_feedback" USING btree ("status","created_at" DESC);--> statement-breakpoint
CREATE INDEX "user_feedback_type_created_idx" ON "user_feedback" USING btree ("type","created_at" DESC);--> statement-breakpoint
CREATE INDEX "user_feedback_user_created_idx" ON "user_feedback" USING btree ("user_id","created_at" DESC);--> statement-breakpoint

-- Keep updated_at fresh on every UPDATE (admin triage), matching every other
-- updated_at table in the repo. The function ships in 20260228155945.
DROP TRIGGER IF EXISTS "on_user_feedback_updated" ON "user_feedback";--> statement-breakpoint
CREATE TRIGGER "on_user_feedback_updated"
	BEFORE UPDATE ON "user_feedback"
	FOR EACH ROW
	EXECUTE FUNCTION public.handle_updated_at();--> statement-breakpoint

-- Row-level security: users may only insert their own feedback; nobody reads
-- via the anon/authed client (admins read through the service-role client,
-- which bypasses RLS). Hand-authored (drizzle-kit does not emit RLS/policies).
ALTER TABLE "user_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "user_feedback_insert_own" ON "user_feedback";--> statement-breakpoint
CREATE POLICY "user_feedback_insert_own" ON "user_feedback"
	FOR INSERT TO authenticated
	WITH CHECK (auth.uid() = user_id);--> statement-breakpoint

-- Private storage bucket for optional feedback screenshots. Objects are
-- namespaced by uploader: `{user_id}/{uuid}.{ext}`. Authenticated users may
-- upload/read only under their own prefix; admins read via signed URLs from the
-- service-role client (which bypasses these policies).
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint
DROP POLICY IF EXISTS "feedback_screenshots_insert_own" ON storage.objects;--> statement-breakpoint
CREATE POLICY "feedback_screenshots_insert_own"
	ON storage.objects
	FOR INSERT TO authenticated
	WITH CHECK (
		bucket_id = 'feedback-screenshots'
		AND (storage.foldername(name))[1] = auth.uid()::text
	);--> statement-breakpoint
DROP POLICY IF EXISTS "feedback_screenshots_select_own" ON storage.objects;--> statement-breakpoint
CREATE POLICY "feedback_screenshots_select_own"
	ON storage.objects
	FOR SELECT TO authenticated
	USING (
		bucket_id = 'feedback-screenshots'
		AND (storage.foldername(name))[1] = auth.uid()::text
	);
