-- scripts/eval-kpis.sql
--
-- Manually-run KPI rollups over `pipeline_runs`. Each block is independent
-- and is intended to be pasted into psql / Drizzle Studio / Supabase SQL
-- Editor. No alerting; this is a "visible-when-reviewed" surface per spec
-- §5.1.
--
-- Conventions:
--   - 7-day rolling window unless otherwise noted.
--   - Where a block needs prompt-version attribution, join
--     `pipeline_runs.request_id` -> `pipeline_requests.id` and read
--     `pipeline_requests.prompt_versions_used ->> 'nutrition'`.
--   - All `_fires` columns are smallint counters from §0.4.

-- 1. Latency percentiles per (model, prompt version).
SELECT
  pr.model_call2,
  pq.prompt_versions_used ->> 'nutrition' AS nutrition_prompt_version_id,
  count(*) AS n,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY pr.total_ms) AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY pr.total_ms) AS p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY pr.total_ms) AS p99_ms
FROM pipeline_runs pr
LEFT JOIN pipeline_requests pq ON pq.id::text = pr.request_id
WHERE pr.created_at >= now() - interval '7 days'
GROUP BY 1, 2
ORDER BY 1, 2;

-- 2. Anomaly rate per AnomalyType per (model, prompt version).
WITH unnested AS (
  SELECT
    pr.model_call2,
    pq.prompt_versions_used ->> 'nutrition' AS nutrition_prompt_version_id,
    unnest(pr.anomaly_types) AS anomaly_type
  FROM pipeline_runs pr
  LEFT JOIN pipeline_requests pq ON pq.id::text = pr.request_id
  WHERE pr.created_at >= now() - interval '7 days'
)
SELECT
  model_call2,
  nutrition_prompt_version_id,
  anomaly_type,
  count(*) AS fires,
  count(*)::numeric
    / nullif(
        (SELECT count(*) FROM pipeline_runs
         WHERE created_at >= now() - interval '7 days'), 0
      ) AS rate
FROM unnested
GROUP BY 1, 2, 3
ORDER BY 1, 2, 4 DESC;

-- 3. Escalation, cache-hit, retry rates.
SELECT
  count(*) AS n,
  avg(CASE WHEN escalated THEN 1 ELSE 0 END) AS escalation_rate,
  avg(CASE WHEN cache_hit_l4 THEN 1 ELSE 0 END) AS cache_hit_rate,
  avg(CASE WHEN retry_count > 0 THEN 1 ELSE 0 END) AS retry_rate,
  avg(CASE WHEN retry_step2_count > 0 THEN 1 ELSE 0 END) AS step2_retry_rate
FROM pipeline_runs
WHERE created_at >= now() - interval '7 days';

-- 4. Match-quality rates per ingredient.
SELECT
  sum(unmatched_count)::numeric
    / nullif(sum(ingredient_count), 0) AS unmatched_rate,
  sum(pre_match_alias_hits)::numeric
    / nullif(sum(ingredient_count), 0) AS alias_hit_rate,
  sum(cooked_to_raw_factor_fires)::numeric
    / nullif(sum(matched_count), 0) AS cooked_to_raw_fire_rate,
  sum(density_envelope_fires)::numeric
    / nullif(sum(ingredient_count), 0) AS density_envelope_rate,
  sum(macro_inconsistent_fires)::numeric
    / nullif(sum(ingredient_count), 0) AS macro_inconsistent_rate
FROM pipeline_runs
WHERE created_at >= now() - interval '7 days';

-- 5. db_state coverage -- Principle B / §0.2.
SELECT
  sum(db_state_unknown_fires)::numeric
    / nullif(sum(matched_count), 0) AS db_state_unknown_rate
FROM pipeline_runs
WHERE created_at >= now() - interval '7 days';

-- 6. Drift watcher -- flag any rate moving >2 sigma from its 7-day baseline.
--    Pure visibility query; no alerting wired.
WITH today AS (
  SELECT
    avg(CASE WHEN retry_count > 0 THEN 1.0 ELSE 0 END) AS retry_rate,
    avg(CASE WHEN escalated THEN 1.0 ELSE 0 END) AS escalation_rate,
    sum(unmatched_count)::numeric
      / nullif(sum(ingredient_count), 0) AS unmatched_rate
  FROM pipeline_runs
  WHERE created_at >= now() - interval '1 day'
),
baseline AS (
  SELECT
    avg(CASE WHEN retry_count > 0 THEN 1.0 ELSE 0 END) AS retry_rate_mean,
    stddev_pop(CASE WHEN retry_count > 0 THEN 1.0 ELSE 0 END) AS retry_rate_sd,
    avg(CASE WHEN escalated THEN 1.0 ELSE 0 END) AS escalation_rate_mean,
    stddev_pop(CASE WHEN escalated THEN 1.0 ELSE 0 END) AS escalation_rate_sd
  FROM pipeline_runs
  WHERE created_at >= now() - interval '7 days'
    AND created_at < now() - interval '1 day'
)
SELECT
  t.retry_rate,
  b.retry_rate_mean,
  b.retry_rate_sd,
  abs(t.retry_rate - b.retry_rate_mean)
    > 2 * coalesce(b.retry_rate_sd, 0) AS retry_rate_drift,
  t.escalation_rate,
  b.escalation_rate_mean,
  b.escalation_rate_sd,
  abs(t.escalation_rate - b.escalation_rate_mean)
    > 2 * coalesce(b.escalation_rate_sd, 0) AS escalation_rate_drift
FROM today t
CROSS JOIN baseline b;

-- =====================================================================
-- §5.2 Shadow runner -- divergence query templates.
-- These are skeletons; tweak windows / thresholds for the question at hand.
-- =====================================================================

-- 7. Macro-divergence histogram by candidate (model, prompt) pair.
SELECT
  candidate_model,
  candidate_prompt_label,
  count(*) AS n,
  avg((divergence ->> 'macroDeltaPct')::numeric) AS mean_macro_delta,
  percentile_cont(0.95) WITHIN GROUP (
    ORDER BY (divergence ->> 'macroDeltaPct')::numeric
  ) AS p95_macro_delta,
  count(*) FILTER (
    WHERE (divergence ->> 'macroDeltaPct')::numeric > 0.30
  ) AS over_30pct
FROM pipeline_shadow_runs
WHERE created_at >= now() - interval '7 days'
  AND outcome = 'completed'
GROUP BY 1, 2
ORDER BY 1, 2;

-- 8. Ingredient-count delta distribution.
SELECT
  (divergence ->> 'ingredientCountDelta')::int AS delta,
  count(*) AS n
FROM pipeline_shadow_runs
WHERE created_at >= now() - interval '7 days'
  AND outcome = 'completed'
GROUP BY 1
ORDER BY 1;

-- 9. Abort-outcome breakdown.
SELECT
  outcome,
  count(*)
FROM pipeline_shadow_runs
WHERE created_at >= now() - interval '7 days'
GROUP BY 1
ORDER BY 2 DESC;

-- ============================================================================
-- KPI BLOCK 7: Escalation cost guardrail (spec §4.2).
--
-- Alerts (visual review only) if escalation rate exceeds 20% over trailing 24h.
-- High escalation = high cost; sustained high escalation means
-- pickComputePolicy is over-firing and warrants threshold review.
--
-- INTERPRETATION:
--   over_20pct_threshold = true means either actual quality degradation is
--   triggering anomaly retries, or pickComputePolicy thresholds are
--   miscalibrated (e.g. 0.5 unmatched ratio too aggressive). Investigate by
--   looking at the anomaly_types breakdown in block 2.
-- ============================================================================
WITH last_24h AS (
  SELECT *
  FROM pipeline_runs
  WHERE created_at >= now() - interval '24 hours'
),
escalated AS (
  SELECT
    count(*) FILTER (
      WHERE model_call2 LIKE '%-flash'
        AND model_call2 NOT LIKE '%lite%'
    ) AS n_escalated,
    count(*) AS n_total
  FROM last_24h
)
SELECT
  n_escalated,
  n_total,
  CASE
    WHEN n_total = 0 THEN 0::numeric
    ELSE round(100.0 * n_escalated / n_total, 2)
  END AS escalation_pct,
  CASE
    WHEN n_total = 0 THEN false
    ELSE (1.0 * n_escalated / n_total) > 0.20
  END AS over_20pct_threshold
FROM escalated;

-- ============================================================================
-- KPI BLOCK 8: Step-2 retry rate (7-day rolling) -- UX flicker proxy.
--
-- Spec §4.4 line 423. If sustained > 10%, the cost of the
-- "first answer -> corrected answer" flicker is high enough to revisit the
-- streaming-vs-buffering trade-off with real data.
-- ============================================================================

-- 8a) Single rolling 7-day rate -- the spec metric.
SELECT
  count(*) FILTER (WHERE retry_step2_count > 0) AS n_retried_7d,
  count(*) AS n_total_7d,
  CASE
    WHEN count(*) = 0 THEN 0::numeric
    ELSE round(
      100.0 * count(*) FILTER (WHERE retry_step2_count > 0) / count(*),
      2
    )
  END AS step2_retry_pct_7d_rolling,
  CASE
    WHEN count(*) = 0 THEN false
    ELSE (1.0 * count(*) FILTER (WHERE retry_step2_count > 0) / count(*))
      > 0.10
  END AS over_10pct_threshold
FROM pipeline_runs
WHERE created_at >= now() - interval '7 days';

-- 8b) Per-day breakdown -- diagnostic only (NOT the spec metric).
SELECT
  date_trunc('day', created_at) AS day,
  count(*) FILTER (WHERE retry_step2_count > 0) AS n_retried,
  count(*) AS n_total,
  CASE
    WHEN count(*) = 0 THEN 0::numeric
    ELSE round(
      100.0 * count(*) FILTER (WHERE retry_step2_count > 0) / count(*),
      2
    )
  END AS step2_retry_pct_daily
FROM pipeline_runs
WHERE created_at >= now() - interval '7 days'
GROUP BY 1
ORDER BY 1 DESC;

-- INTERPRETATION:
--   Block 8a is the spec metric: a single rolling 7-day rate. If
--   over_10pct_threshold = true, revisit the buffer-vs-stream decision in
--   §4.4. Block 8b is a diagnostic per-day breakdown to help locate whether
--   the regression is a sustained shift or a single bad day.
