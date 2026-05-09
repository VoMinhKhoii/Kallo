-- analysis_guard_events stores server-only blocked-request telemetry.
-- It contains hashed identifiers only and is never read directly by clients.
BEGIN;

ALTER TABLE public.analysis_guard_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.analysis_guard_events FROM authenticated, anon;
GRANT SELECT, INSERT ON public.analysis_guard_events TO service_role;

COMMIT;