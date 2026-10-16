-- Admin dashboard windows are now 24h / 7d / 30d (owner, 2026-10-16): keep
-- the flattened decisions view to 30 days (was 90) and append the request's
-- exact time so the dashboard can bucket a rolling 24 h by hour. occurred_at is
-- NULL once the request row is reaped (7 days); occurred_on (UTC day) stays the
-- bucket for longer windows. Columns are only appended, so CREATE OR REPLACE
-- keeps every existing reader working.
SET search_path = public, extensions, analytics;

CREATE OR REPLACE VIEW analytics.v_ingredient_decisions
WITH (security_invoker = false)
AS
WITH source AS (
    SELECT
        vp.request_id,
        vp.d AS occurred_on,
        vp.gidx,
        vp.verdict,
        vp.sel,
        vp.pool,
        vp.cands,
        vp.ing_name,
        vp.reject_reason
    FROM analytics.v_verdict_pool AS vp
    WHERE vp.d >= (now() - interval '30 days')::date
      AND vp.verdict IN ('accepted', 'unmatched', 'rejected', 'missing')
), prepared AS (
    SELECT
        s.*,
        s.cands -> 0 -> 'info' AS candidate_1,
        s.cands -> 1 -> 'info' AS candidate_2,
        s.cands -> 2 -> 'info' AS candidate_3,
        CASE
            WHEN s.sel IS NOT NULL
                 AND s.sel >= 0
                 AND s.cands IS NOT NULL
                 AND s.sel < jsonb_array_length(s.cands)
            THEN s.cands -> s.sel -> 'info'
        END AS chosen
    FROM source AS s
)
SELECT
    encode(
        hmac(
            'ingredient-decision:' || request_id::text || ':'
                || occurred_on::text || ':' || gidx::text,
            (SELECT pepper FROM analytics.pepper),
            'sha256'
        ),
        'hex'
    ) AS decision_key,
    occurred_on,
    CASE
        WHEN ing_name IS NOT NULL
             AND length(btrim(ing_name)) BETWEEN 1 AND 160
        THEN lower(regexp_replace(btrim(ing_name), '\s+', ' ', 'g'))
    END AS ingredient_query,
    verdict,
    pool AS pool_size,
    CASE
        WHEN sel IS NOT NULL
             AND sel >= 0
             AND cands IS NOT NULL
             AND sel < jsonb_array_length(cands)
        THEN sel + 1
    END AS selected_rank,
    CASE
        WHEN verdict = 'accepted' THEN NULL
        WHEN verdict = 'unmatched' THEN 'unmatched'
        WHEN verdict = 'missing' THEN 'missing'
        WHEN lower(coalesce(reject_reason, '')) ~ '(no|zero|missing).*(candidate|match)'
            THEN 'no_candidates'
        WHEN lower(coalesce(reject_reason, '')) ~ '(confidence|similarity|score)'
            THEN 'low_confidence'
        WHEN lower(coalesce(reject_reason, '')) ~ '(invalid|malformed|empty|parse)'
            THEN 'invalid_input'
        WHEN lower(coalesce(reject_reason, '')) ~ '(model|reject|refus)'
            THEN 'model_rejected'
        ELSE 'other'
    END AS reject_bucket,
    CASE
        WHEN candidate_1->>'foodCompositionId' ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$'
        THEN candidate_1->>'foodCompositionId'
    END AS candidate_1_food_id,
    CASE
        WHEN length(btrim(candidate_1->>'matchedName')) BETWEEN 1 AND 200
        THEN regexp_replace(btrim(candidate_1->>'matchedName'), '\s+', ' ', 'g')
    END AS candidate_1_name,
    CASE
        WHEN candidate_1->>'source' ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$'
        THEN candidate_1->>'source'
    END AS candidate_1_source,
    CASE
        WHEN candidate_1->>'similarity' ~ '^(0(\.[0-9]+)?|1(\.0+)?)$'
        THEN round((candidate_1->>'similarity')::numeric, 6)
    END AS candidate_1_similarity,
    CASE
        WHEN candidate_2->>'foodCompositionId' ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$'
        THEN candidate_2->>'foodCompositionId'
    END AS candidate_2_food_id,
    CASE
        WHEN length(btrim(candidate_2->>'matchedName')) BETWEEN 1 AND 200
        THEN regexp_replace(btrim(candidate_2->>'matchedName'), '\s+', ' ', 'g')
    END AS candidate_2_name,
    CASE
        WHEN candidate_2->>'source' ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$'
        THEN candidate_2->>'source'
    END AS candidate_2_source,
    CASE
        WHEN candidate_2->>'similarity' ~ '^(0(\.[0-9]+)?|1(\.0+)?)$'
        THEN round((candidate_2->>'similarity')::numeric, 6)
    END AS candidate_2_similarity,
    CASE
        WHEN candidate_3->>'foodCompositionId' ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$'
        THEN candidate_3->>'foodCompositionId'
    END AS candidate_3_food_id,
    CASE
        WHEN length(btrim(candidate_3->>'matchedName')) BETWEEN 1 AND 200
        THEN regexp_replace(btrim(candidate_3->>'matchedName'), '\s+', ' ', 'g')
    END AS candidate_3_name,
    CASE
        WHEN candidate_3->>'source' ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$'
        THEN candidate_3->>'source'
    END AS candidate_3_source,
    CASE
        WHEN candidate_3->>'similarity' ~ '^(0(\.[0-9]+)?|1(\.0+)?)$'
        THEN round((candidate_3->>'similarity')::numeric, 6)
    END AS candidate_3_similarity,
    CASE
        WHEN chosen->>'foodCompositionId' ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$'
        THEN chosen->>'foodCompositionId'
    END AS chosen_food_id,
    CASE
        WHEN length(btrim(chosen->>'matchedName')) BETWEEN 1 AND 200
        THEN regexp_replace(btrim(chosen->>'matchedName'), '\s+', ' ', 'g')
    END AS chosen_name,
    CASE
        WHEN chosen->>'source' ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$'
        THEN chosen->>'source'
    END AS chosen_source,
    CASE
        WHEN chosen->>'similarity' ~ '^(0(\.[0-9]+)?|1(\.0+)?)$'
        THEN round((chosen->>'similarity')::numeric, 6)
    END AS chosen_similarity,
    (SELECT r.created_at FROM public.pipeline_requests AS r WHERE r.id = prepared.request_id) AS occurred_at
FROM prepared;

COMMENT ON VIEW analytics.v_ingredient_decisions IS
    'Flattened ingredient decisions (last 30 days) with bounded food labels, candidate ranks, opaque decision keys and exact request time.';

REVOKE ALL PRIVILEGES ON TABLE analytics.v_ingredient_decisions
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE analytics.v_ingredient_decisions
TO analytics_reader;
