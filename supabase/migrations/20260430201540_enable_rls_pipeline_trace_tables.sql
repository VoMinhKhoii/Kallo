-- Enable RLS on pipeline trace tables for defense-in-depth.
-- No policies are needed: Drizzle bypasses RLS via DATABASE_URL (service-role),
-- and anonymous/authenticated roles are already REVOKEd in the prior migration.
-- This ensures no future policy omission accidentally exposes rows.

ALTER TABLE public.pipeline_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_llm_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
