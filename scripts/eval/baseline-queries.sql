-- Phase 0 baseline queries for the AI meal-analysis pipeline.
-- Run each statement independently in the Supabase SQL editor.
-- Adjust the 30-day window as needed. pipeline_version is authoritative for
-- completed runs; failed requests fall back to the grounded prompt names
-- because a pipeline_runs row is only written after successful assembly.

-- 1. Per-stage latency percentiles, segmented by pipeline version.
SELECT
  pr.pipeline_version,
  psl.stage,
  COUNT(*) AS stage_runs,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY psl.duration_ms) AS p50_ms,
  percentile_cont(0.90) WITHIN GROUP (ORDER BY psl.duration_ms) AS p90_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY psl.duration_ms) AS p95_ms,
  MAX(psl.duration_ms) AS max_ms
FROM public.pipeline_runs AS pr
JOIN public.pipeline_stage_logs AS psl
  ON psl.request_id::text = pr.request_id
WHERE pr.created_at >= now() - interval '30 days'
GROUP BY pr.pipeline_version, psl.stage
ORDER BY pr.pipeline_version, psl.stage;

-- 2. Request failure taxonomy. The prompt-version fallback keeps timed-out
-- runs segmentable even though they do not reach the pipeline_runs write.
WITH request_versions AS (
  SELECT
    pq.id,
    pq.status,
    pq.error,
    COALESCE(
      pr.pipeline_version,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.pipeline_llm_calls AS plc
          JOIN public.prompt_versions AS pv ON pv.id = plc.prompt_version_id
          WHERE plc.request_id = pq.id
            AND pv.name IN ('decomposition-grounded', 'grounded-estimation')
        ) THEN 'v2'
        -- Positive v1 evidence required: a request that failed BEFORE its
        -- first LLM call has no prompt rows at all and must not pollute the
        -- v1 failure/timeout cohort.
        WHEN EXISTS (
          SELECT 1
          FROM public.pipeline_llm_calls AS plc
          WHERE plc.request_id = pq.id
        ) THEN 'v1'
        ELSE 'unknown'
      END
    ) AS pipeline_version
  FROM public.pipeline_requests AS pq
  LEFT JOIN public.pipeline_runs AS pr ON pr.request_id = pq.id::text
  WHERE pq.created_at >= now() - interval '30 days'
)
SELECT
  pipeline_version,
  CASE
    WHEN error ~* 'took too long|timeout|timed out' THEN 'timeout'
    WHEN error ~* '429|rate.?limit|quota' THEN 'rate_limit_or_quota'
    WHEN error ~* 'parse|json|zod' THEN 'parse_error'
    WHEN error ~* 'not.*meal|non.?food|recognize.*meal' THEN 'non_food'
    WHEN error IS NULL THEN 'missing_error_detail'
    ELSE 'other'
  END AS failure_type,
  COUNT(*) AS failures
FROM request_versions
WHERE status = 'error'
GROUP BY pipeline_version, failure_type
ORDER BY pipeline_version, failures DESC;

-- 3. Grounding coverage from final v1/v2 verdict-derived run counts.
SELECT
  pipeline_version,
  COUNT(*) AS runs,
  SUM(ingredient_count) AS ingredients,
  SUM(matched_count) AS matched,
  SUM(unmatched_count) AS unmatched,
  ROUND(
    SUM(matched_count)::numeric / NULLIF(SUM(ingredient_count), 0),
    4
  ) AS matched_rate,
  ROUND(
    SUM(unmatched_count)::numeric / NULLIF(SUM(ingredient_count), 0),
    4
  ) AS unmatched_rate
FROM public.pipeline_runs
WHERE created_at >= now() - interval '30 days'
GROUP BY pipeline_version
ORDER BY pipeline_version;

-- 4. Timeout attribution by stage and source. A request can have more than
-- one source signal (stage error + budget event), so counts are signal counts.
WITH request_versions AS (
  SELECT
    pq.id,
    COALESCE(
      pr.pipeline_version,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.pipeline_llm_calls AS plc
          JOIN public.prompt_versions AS pv ON pv.id = plc.prompt_version_id
          WHERE plc.request_id = pq.id
            AND pv.name IN ('decomposition-grounded', 'grounded-estimation')
        ) THEN 'v2'
        -- Positive v1 evidence required: a request that failed BEFORE its
        -- first LLM call has no prompt rows at all and must not pollute the
        -- v1 failure/timeout cohort.
        WHEN EXISTS (
          SELECT 1
          FROM public.pipeline_llm_calls AS plc
          WHERE plc.request_id = pq.id
        ) THEN 'v1'
        ELSE 'unknown'
      END
    ) AS pipeline_version
  FROM public.pipeline_requests AS pq
  LEFT JOIN public.pipeline_runs AS pr ON pr.request_id = pq.id::text
  WHERE pq.created_at >= now() - interval '30 days'
), timeout_signals AS (
  SELECT
    request_id::text AS request_id,
    stage,
    'stage_log'::text AS source
  FROM public.pipeline_stage_logs
  WHERE status = 'error'
    AND error ~* 'took too long|timeout|timed out|abort'
  UNION ALL
  SELECT
    request_id::text AS request_id,
    'request'::text AS stage,
    'pipeline_request'::text AS source
  FROM public.pipeline_requests
  WHERE status = 'error'
    AND error ~* 'took too long|timeout|timed out|abort'
  UNION ALL
  SELECT
    request_id,
    'provider'::text AS stage,
    'budget_event'::text AS source
  FROM public.analysis_model_budget_events
  WHERE error_category = 'timeout'
    AND request_id IS NOT NULL
)
SELECT
  rv.pipeline_version,
  ts.stage,
  ts.source,
  COUNT(*) AS timeout_signals
FROM timeout_signals AS ts
JOIN request_versions AS rv ON rv.id::text = ts.request_id
GROUP BY rv.pipeline_version, ts.stage, ts.source
ORDER BY rv.pipeline_version, timeout_signals DESC, ts.stage;

-- 5. Provider retry distribution. For each logical Gemini call (stage log),
-- max(attempt)-1 is the retry count; pipeline_runs.retry_count stores the sum.
WITH retries_per_call AS (
  SELECT
    request_id,
    stage_log_id,
    GREATEST(MAX(attempt) - 1, 0) AS retries
  FROM public.pipeline_llm_calls
  WHERE created_at >= now() - interval '30 days'
  GROUP BY request_id, stage_log_id
), retries_per_request AS (
  SELECT request_id, SUM(retries) AS retries
  FROM retries_per_call
  GROUP BY request_id
)
SELECT
  pr.pipeline_version,
  COUNT(*) AS runs,
  AVG(COALESCE(rpr.retries, 0)) AS avg_provider_retries,
  MAX(COALESCE(rpr.retries, 0)) AS max_provider_retries,
  COUNT(*) FILTER (WHERE COALESCE(rpr.retries, 0) > 0) AS retried_runs
FROM public.pipeline_runs AS pr
LEFT JOIN retries_per_request AS rpr ON rpr.request_id::text = pr.request_id
WHERE pr.created_at >= now() - interval '30 days'
GROUP BY pr.pipeline_version
ORDER BY pr.pipeline_version;
