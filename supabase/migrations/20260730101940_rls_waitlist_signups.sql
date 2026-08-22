SET search_path TO public, extensions;

-- Waitlist rows are pure PII (an email address) plus a bearer credential (the
-- confirmation token hash), and no client ever has a legitimate reason to read
-- or write them: signup and confirmation both run server-side through
-- DATABASE_URL, which is not subject to RLS.
--
-- So this is deliberately stricter than the other tables in this schema — RLS
-- on with *no policies at all*, which denies everything to anon and
-- authenticated, plus an explicit REVOKE so a future permissive GRANT to those
-- roles can't quietly re-expose the table through PostgREST.
ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE waitlist_signups FROM anon, authenticated;
