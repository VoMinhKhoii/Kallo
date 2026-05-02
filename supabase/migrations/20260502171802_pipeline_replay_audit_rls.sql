-- pipeline_request_replay_audit_logs records admin replay attempts.
-- Service role only; no user-facing app reads from this table.
BEGIN;

ALTER TABLE public.pipeline_request_replay_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pipeline_request_replay_audit_logs FROM authenticated, anon;
GRANT SELECT, INSERT ON public.pipeline_request_replay_audit_logs TO service_role;

COMMIT;
