-- =============================================================================
-- Domain B (hand-authored): RLS for content_reports
--
-- The table itself is Domain A (drizzle-kit, 20260925120000). This file owns
-- the policies and must never be overwritten by `drizzle-kit generate`.
--
-- The app writes and reads reports only on the Drizzle owner connection
-- (POST /api/v1/reports, with an explicit reporter_id taken from the session),
-- and the API-role table grants were already revoked wholesale by
-- 20260825120000_lock_postgrest_data_plane.sql, whose default privileges also
-- cover tables created after it. The policies below are belt and braces and
-- describe intent: a reporter may file a report as themselves and read back
-- their own reports, nothing more.
--
-- No UPDATE and no DELETE policy, deliberately: triage status and resolved_at
-- are set by admins on the server, and a reporter must not be able to
-- withdraw or rewrite a report once filed. The absence of those policies is
-- the enforcement.
-- =============================================================================

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters can view own content reports"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Reporters can file content reports as themselves"
  ON public.content_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND status = 'open');
