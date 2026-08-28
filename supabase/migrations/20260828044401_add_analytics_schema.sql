CREATE SCHEMA IF NOT EXISTS analytics;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- pgcrypto is installed in Supabase's extensions schema. Object references in
-- the views are still schema-qualified; this path is only needed to resolve
-- hmac while the view definitions are created.
SET search_path = public, extensions, analytics;

CREATE TABLE IF NOT EXISTS analytics.pepper (
    pepper text NOT NULL
);

-- A constant-expression unique index makes analytics.pepper a one-row table.
CREATE UNIQUE INDEX IF NOT EXISTS analytics_pepper_single_row
    ON analytics.pepper ((true));

INSERT INTO analytics.pepper (pepper)
SELECT 'REPLACE_WITH_A_SECURE_RANDOM_ANALYTICS_PEPPER'
WHERE NOT EXISTS (
    SELECT 1
    FROM analytics.pepper
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_roles
        WHERE rolname = 'analytics_reader'
    ) THEN
        CREATE ROLE analytics_reader NOLOGIN;
    END IF;
END
$$;

-- PostgREST connects as authenticator, then assumes the role from the JWT.
GRANT analytics_reader TO authenticator;

REVOKE ALL PRIVILEGES ON TABLE analytics.pepper FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE analytics.pepper FROM analytics_reader;

CREATE OR REPLACE VIEW analytics.v_pipeline_runs
WITH (security_invoker = false)
AS
SELECT
    pr.id,
    pr.created_at,
    pr.pipeline_version,
    pr.model_call1,
    pr.model_call2,
    pr.total_ms,
    pr.ingredient_count,
    pr.matched_count,
    pr.unmatched_count,
    pr.retry_count,
    pr.escalated,
    pr.cache_hit_l4
FROM public.pipeline_runs AS pr;

COMMENT ON VIEW analytics.v_pipeline_runs IS
    'Definer semantics are safe here: this read-only view exposes only explicitly allowlisted columns.';

CREATE OR REPLACE VIEW analytics.v_budget_events
WITH (security_invoker = false)
AS
SELECT
    be.id,
    be.created_at,
    be.request_id,
    be.route,
    be.work_kind,
    be.provider,
    be.model,
    be.request_count,
    be.input_tokens,
    be.output_tokens,
    be.error_category
FROM public.analysis_model_budget_events AS be;

COMMENT ON VIEW analytics.v_budget_events IS
    'Definer semantics are safe here: this read-only view exposes only explicitly allowlisted columns.';

CREATE OR REPLACE VIEW analytics.v_meals
WITH (security_invoker = false)
AS
SELECT
    m.id,
    encode(hmac(user_id::text, (SELECT pepper FROM analytics.pepper), 'sha256'), 'hex') AS user_hash,
    date_trunc('hour', m.logged_at) AS logged_at,
    m.meal_slot,
    m.entry_mode,
    m.confidence_overall,
    m.calories_kcal,
    m.protein_g,
    m.carbohydrate_g,
    m.fat_g,
    m.fiber_g
FROM public.meals AS m;

COMMENT ON VIEW analytics.v_meals IS
    'Definer semantics are safe here: this read-only view exposes only explicitly allowlisted columns.';

-- Food names are required for analytics. No source PII flag currently exists;
-- add its exclusion predicate here if the application introduces one.
CREATE OR REPLACE VIEW analytics.v_meal_items
WITH (security_invoker = false)
AS
SELECT
    mi.id,
    mi.meal_id,
    mi.ingredient_name,
    mi.food_composition_id,
    mi.estimated_grams,
    mi.match_confidence,
    mi.cooking_method,
    mi.created_at
FROM public.meal_items AS mi;

COMMENT ON VIEW analytics.v_meal_items IS
    'Definer semantics are safe here: this read-only view exposes only explicitly allowlisted columns.';

-- Food names are required for analytics. No source PII flag currently exists;
-- add its exclusion predicate here if the application introduces one.
CREATE OR REPLACE VIEW analytics.v_unmatched_ingredients
WITH (security_invoker = false)
AS
SELECT
    ui.id,
    ui.query_text,
    ui.created_at
FROM public.unmatched_ingredients AS ui;

COMMENT ON VIEW analytics.v_unmatched_ingredients IS
    'Definer semantics are safe here: this read-only view exposes only explicitly allowlisted columns.';

CREATE OR REPLACE VIEW analytics.v_user_funnel
WITH (security_invoker = false)
AS
SELECT
    encode(hmac(user_id::text, (SELECT pepper FROM analytics.pepper), 'sha256'), 'hex') AS user_hash,
    date_trunc('day', up.created_at) AS created_at,
    up.onboarding_step,
    date_trunc('day', up.onboarding_completed_at) AS onboarding_completed_at,
    up.goal,
    up.preferred_locale
FROM public.user_profiles AS up;

COMMENT ON VIEW analytics.v_user_funnel IS
    'Definer semantics are safe here: this read-only view exposes only explicitly allowlisted columns.';

CREATE OR REPLACE VIEW analytics.v_food_composition
WITH (security_invoker = false)
AS
SELECT
    fc.id,
    fc.name_en,
    fc.type_en,
    fc.state,
    fc.source_id,
    fc.serving_size_g,
    fc.calories_kcal,
    fc.protein_g,
    fc.carbohydrate_g,
    fc.fat_g,
    fc.fiber_g
FROM public.vietnamese_food_composition AS fc;

COMMENT ON VIEW analytics.v_food_composition IS
    'Definer semantics are safe here: this read-only view exposes only explicitly allowlisted columns.';

REVOKE ALL PRIVILEGES ON TABLE
    analytics.v_pipeline_runs,
    analytics.v_budget_events,
    analytics.v_meals,
    analytics.v_meal_items,
    analytics.v_unmatched_ingredients,
    analytics.v_user_funnel,
    analytics.v_food_composition
FROM PUBLIC;

GRANT USAGE ON SCHEMA analytics TO analytics_reader;

GRANT SELECT ON TABLE
    analytics.v_pipeline_runs,
    analytics.v_budget_events,
    analytics.v_meals,
    analytics.v_meal_items,
    analytics.v_unmatched_ingredients,
    analytics.v_user_funnel,
    analytics.v_food_composition
TO analytics_reader;
