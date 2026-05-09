-- pipeline_llm_call_metadata stores server-only operational LLM call metadata.
-- It contains no raw input, user context, user identifiers, or secrets.
BEGIN;

ALTER TABLE public.pipeline_llm_call_metadata ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pipeline_llm_call_metadata FROM authenticated, anon;
GRANT SELECT, INSERT ON public.pipeline_llm_call_metadata TO service_role;

COMMIT;