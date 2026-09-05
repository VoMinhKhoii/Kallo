BEGIN;

-- Retire user-journey and meal-detail export surfaces. Source application
-- tables remain untouched; this migration only narrows the analytics schema.
DROP FUNCTION IF EXISTS public.analytics_summary(text);
DROP FUNCTION IF EXISTS public.analytics_weeks();
DROP FUNCTION IF EXISTS analytics.summary(text);
DROP FUNCTION IF EXISTS analytics.weeks();

DROP VIEW IF EXISTS analytics.v_product_events;
DROP VIEW IF EXISTS analytics.v_pipeline_meals;
DROP VIEW IF EXISTS analytics.v_user_funnel;
DROP VIEW IF EXISTS analytics.v_meal_items;
DROP VIEW IF EXISTS analytics.v_unmatched_ingredients;

-- App health is operational telemetry and needs no actor identity, including
-- a pseudonymous one. Recreate the view with only controlled app-level fields.
DROP VIEW IF EXISTS analytics.v_app_health;
CREATE VIEW analytics.v_app_health
WITH (security_invoker = false)
AS
SELECT
    p.event_id,
    p.occurred_at,
    p.platform,
    CASE
        WHEN p.app_version IS NULL THEN NULL
        WHEN p.app_version ~ '^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,63}$' THEN p.app_version
    END AS app_version,
    p.event_name,
    CASE
        WHEN p.event_name = 'api_request_failed'
             AND p.properties->>'route' ~ '^[a-z][a-z0-9_]{0,63}$' THEN p.properties->>'route'
    END AS route,
    CASE
        WHEN p.event_name = 'performance_measured'
             AND p.properties->>'metric' IN ('app_startup', 'screen_render', 'meal_analysis', 'meal_save', 'api_request')
             THEN p.properties->>'metric'
    END AS metric,
    CASE
        WHEN p.event_name = 'health_check_failed'
             AND p.properties->>'check' IN ('api_reachable', 'auth_session', 'telemetry_ingest')
             THEN p.properties->>'check'
    END AS check,
    CASE
        WHEN p.event_name = 'api_request_failed'
             AND p.properties->>'statusCode' ~ '^[45][0-9]{2}$'
             THEN (p.properties->>'statusCode')::integer
    END AS status_code,
    CASE
        WHEN p.event_name IN ('performance_measured', 'health_check_failed')
             AND p.properties->>'durationMs' ~ '^[0-9]{1,6}$'
             AND (p.properties->>'durationMs')::integer BETWEEN 0 AND 120000
             THEN (p.properties->>'durationMs')::integer
    END AS duration_ms,
    CASE
        WHEN p.event_name = 'app_crashed'
             AND p.properties->>'fatal' IN ('true', 'false')
             THEN (p.properties->>'fatal')::boolean
    END AS fatal
FROM public.product_telemetry_events AS p
WHERE p.event_name IN ('api_request_failed', 'app_crashed', 'performance_measured', 'health_check_failed')
  AND p.occurred_at >= now() - interval '90 days';

COMMENT ON VIEW analytics.v_app_health IS
    'Controlled app-level health fields with no actor, session, error text, or stack trace.';

REVOKE ALL PRIVILEGES ON TABLE analytics.v_app_health FROM PUBLIC;
GRANT SELECT ON TABLE analytics.v_app_health TO analytics_reader;

COMMIT;
