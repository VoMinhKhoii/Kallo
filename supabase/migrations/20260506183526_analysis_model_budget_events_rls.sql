-- analysis_model_budget_events stores server-only operational budget state.
-- It contains no raw input, user context, user identifiers, or secrets.
BEGIN;

ALTER TABLE public.analysis_model_budget_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.analysis_model_budget_events FROM authenticated, anon;
GRANT SELECT, INSERT ON public.analysis_model_budget_events TO service_role;

COMMIT;