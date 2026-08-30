-- Phase 2A: privacy-safe product telemetry and AI meal correlation views.
--
-- This migration is append-only and must run after the Kallo migration that
-- creates product_telemetry_events and adds meals.pipeline_request_id. The
-- source table is intentionally never granted to the restricted extract role.
SET search_path = public, extensions, analytics;

CREATE OR REPLACE VIEW analytics.v_product_events
WITH (security_invoker = false)
AS
SELECT
    p.event_id,
    p.occurred_at,
    CASE
        WHEN p.user_id IS NOT NULL THEN
            encode(hmac(p.user_id::text, (SELECT pepper FROM analytics.pepper), 'sha256'), 'hex')
        WHEN p.anonymous_id IS NOT NULL AND p.consent IS TRUE THEN
            encode(hmac('anonymous:' || p.anonymous_id, (SELECT pepper FROM analytics.pepper), 'sha256'), 'hex')
    END AS actor_hash,
    CASE
        WHEN p.anonymous_id IS NOT NULL AND p.consent IS TRUE THEN
            encode(hmac('anonymous:' || p.anonymous_id, (SELECT pepper FROM analytics.pepper), 'sha256'), 'hex')
    END AS anonymous_hash,
    CASE
        WHEN p.session_id IS NOT NULL
             AND (p.user_id IS NOT NULL OR p.consent IS TRUE) THEN
            encode(hmac('session:' || p.session_id, (SELECT pepper FROM analytics.pepper), 'sha256'), 'hex')
    END AS session_hash,
    p.platform,
    CASE
        WHEN p.app_version IS NULL THEN NULL
        WHEN p.app_version ~ '^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,63}$' THEN p.app_version
    END AS app_version,
    CASE
        WHEN p.locale IS NULL THEN NULL
        WHEN p.locale ~ '^[a-zA-Z]{2,3}([_-][a-zA-Z0-9]{2,8})?$' THEN p.locale
    END AS locale,
    p.event_name,
    CASE
        WHEN p.event_name = 'app_opened'
             AND p.properties->>'coldStart' IN ('true', 'false') THEN
            (p.properties->>'coldStart')::boolean
    END AS cold_start,
    CASE
        WHEN p.event_name = 'screen_viewed'
             AND p.properties->>'screen' ~ '^[a-z][a-z0-9_]{0,47}$' THEN
            p.properties->>'screen'
    END AS screen_key,
    CASE
        WHEN p.event_name IN ('signup_started', 'signup_completed')
             AND p.properties->>'method' IN ('email', 'google', 'apple', 'other') THEN
            p.properties->>'method'
    END AS signup_method,
    CASE
        WHEN p.event_name IN ('meal_analysis_started', 'meal_analysis_completed', 'meal_analysis_failed')
             AND p.properties->>'mode' IN ('precise', 'cheat') THEN
            p.properties->>'mode'
    END AS analysis_mode,
    CASE
        WHEN p.event_name = 'meal_analysis_started'
             AND p.properties->>'hasReferences' IN ('true', 'false') THEN
            (p.properties->>'hasReferences')::boolean
    END AS has_references,
    CASE
        WHEN p.event_name = 'meal_analysis_completed'
             AND p.properties->>'durationMs' ~ '^[0-9]{1,6}$'
             AND (p.properties->>'durationMs')::integer BETWEEN 0 AND 120000 THEN
            (p.properties->>'durationMs')::integer
    END AS duration_ms,
    CASE
        WHEN p.event_name = 'meal_analysis_failed'
             AND p.properties->>'retryable' IN ('true', 'false') THEN
            (p.properties->>'retryable')::boolean
    END AS retryable,
    CASE
        WHEN p.event_name IN ('meal_saved', 'meal_discarded')
             AND p.properties->>'entryMode' IN (
                 'precise', 'cheat', 'manual', 'barcode', 'nutrition_label', 'relog'
             ) THEN
            p.properties->>'entryMode'
    END AS entry_mode,
    CASE
        WHEN p.event_name = 'meal_edited'
             AND p.properties->>'editCount' ~ '^[1-9][0-9]?$|^100$' THEN
            (p.properties->>'editCount')::integer
    END AS edit_count,
    CASE
        WHEN p.event_name IN ('onboarding_step_viewed', 'onboarding_step_completed')
             AND p.properties->>'step' ~ '^[0-3]$' THEN
            (p.properties->>'step')::integer
    END AS onboarding_step,
    CASE
        WHEN p.event_name IN ('feature_viewed', 'feature_used', 'feature_adopted')
             AND p.properties->>'feature' IN (
                 'meal_logging', 'ai_analysis', 'cheat_meals', 'barcode_logging',
                 'nutrition_label', 'relog', 'dashboard', 'weight_tracking',
                 'social_circle', 'onboarding'
             ) THEN
            p.properties->>'feature'
    END AS feature_key,
    CASE
        WHEN p.event_name = 'feedback_submitted'
             AND p.properties->>'type' IN ('bug', 'ingredient', 'idea') THEN
            p.properties->>'type'
    END AS feedback_type
FROM public.product_telemetry_events AS p
WHERE p.event_name IN (
    'app_opened', 'screen_viewed', 'signup_started', 'signup_completed',
    'meal_analysis_started', 'meal_analysis_completed', 'meal_analysis_failed',
    'meal_saved', 'meal_discarded', 'meal_edited', 'onboarding_step_viewed',
    'onboarding_step_completed', 'onboarding_completed', 'feature_viewed',
    'feature_used', 'feature_adopted', 'feedback_submitted'
)
  AND p.occurred_at >= now() - interval '90 days';

COMMENT ON VIEW analytics.v_product_events IS
    'Ordered product-event fact with HMAC identities and closed scalar property fields only.';

CREATE OR REPLACE VIEW analytics.v_app_health
WITH (security_invoker = false)
AS
SELECT
    p.event_id,
    p.occurred_at,
    CASE
        WHEN p.user_id IS NOT NULL THEN
            encode(hmac(p.user_id::text, (SELECT pepper FROM analytics.pepper), 'sha256'), 'hex')
        WHEN p.anonymous_id IS NOT NULL AND p.consent IS TRUE THEN
            encode(hmac('anonymous:' || p.anonymous_id, (SELECT pepper FROM analytics.pepper), 'sha256'), 'hex')
    END AS actor_hash,
    p.platform,
    CASE
        WHEN p.app_version IS NULL THEN NULL
        WHEN p.app_version ~ '^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,63}$' THEN p.app_version
    END AS app_version,
    p.event_name,
    CASE
        WHEN p.event_name = 'api_request_failed'
             AND p.properties->>'route' ~ '^[a-z][a-z0-9_]{0,63}$' THEN
            p.properties->>'route'
    END AS route,
    CASE
        WHEN p.event_name = 'performance_measured'
             AND p.properties->>'metric' IN (
                 'app_startup', 'screen_render', 'meal_analysis', 'meal_save', 'api_request'
             ) THEN
            p.properties->>'metric'
    END AS metric,
    CASE
        WHEN p.event_name = 'health_check_failed'
             AND p.properties->>'check' IN (
                 'api_reachable', 'auth_session', 'telemetry_ingest'
             ) THEN
            p.properties->>'check'
    END AS check,
    CASE
        WHEN p.event_name = 'api_request_failed'
             AND p.properties->>'statusCode' ~ '^[45][0-9]{2}$' THEN
            (p.properties->>'statusCode')::integer
    END AS status_code,
    CASE
        WHEN p.event_name IN ('performance_measured', 'health_check_failed')
             AND p.properties->>'durationMs' ~ '^[0-9]{1,6}$'
             AND (p.properties->>'durationMs')::integer BETWEEN 0 AND 120000 THEN
            (p.properties->>'durationMs')::integer
    END AS duration_ms,
    CASE
        WHEN p.event_name = 'app_crashed'
             AND p.properties->>'fatal' IN ('true', 'false') THEN
            (p.properties->>'fatal')::boolean
    END AS fatal
FROM public.product_telemetry_events AS p
WHERE p.event_name IN (
    'api_request_failed', 'app_crashed', 'performance_measured', 'health_check_failed'
)
  AND p.occurred_at >= now() - interval '90 days';

COMMENT ON VIEW analytics.v_app_health IS
    'Controlled application health, latency, and failure fields; no request content is exposed.';

CREATE OR REPLACE VIEW analytics.v_pipeline_meals
WITH (security_invoker = false)
AS
SELECT
    m.id AS meal_id,
    m.pipeline_request_id,
    encode(hmac(m.user_id::text, (SELECT pepper FROM analytics.pepper), 'sha256'), 'hex') AS user_hash,
    date_trunc('hour', m.logged_at) AS logged_at,
    m.entry_mode
FROM public.meals AS m
INNER JOIN public.pipeline_requests AS pr
    ON pr.id = m.pipeline_request_id
   AND pr.user_id = m.user_id
WHERE m.pipeline_request_id IS NOT NULL
  AND m.logged_at >= now() - interval '90 days';

COMMENT ON VIEW analytics.v_pipeline_meals IS
    'AI pipeline-to-meal correlation with ownership-checked opaque identifiers and hour-truncated time.';

REVOKE ALL PRIVILEGES ON TABLE
    analytics.v_product_events,
    analytics.v_app_health,
    analytics.v_pipeline_meals
FROM PUBLIC;

GRANT SELECT ON TABLE
    analytics.v_product_events,
    analytics.v_app_health,
    analytics.v_pipeline_meals
TO analytics_reader;
