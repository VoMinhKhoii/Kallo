-- analysis limiter tables store server-owned guard state with hashed keys only.
-- They are not directly readable or writable by client roles.
BEGIN;

ALTER TABLE public.analysis_rate_limit_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_in_flight_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.analysis_rate_limit_windows FROM authenticated, anon;
REVOKE ALL ON public.analysis_in_flight_limits FROM authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_rate_limit_windows TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_in_flight_limits TO service_role;

COMMIT;