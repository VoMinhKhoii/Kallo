-- Revoke direct access to admin pipeline trace tables from anon/authenticated.
-- These tables are admin-only; reads MUST go through service-role queries
-- (via lib/admin/queries.ts) and writes happen server-side only.
SET search_path TO public, extensions;

REVOKE ALL ON TABLE public.pipeline_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.pipeline_stage_logs FROM anon, authenticated;
REVOKE ALL ON TABLE public.pipeline_llm_calls FROM anon, authenticated;
REVOKE ALL ON TABLE public.prompt_versions FROM anon, authenticated;
