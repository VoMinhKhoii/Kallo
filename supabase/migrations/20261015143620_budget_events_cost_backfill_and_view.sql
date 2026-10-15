-- Domain B: price the existing attempt rows and expose the new columns to the
-- admin dashboard.
--
-- 1. Backfill analysis_model_budget_events.cost_usd for attempt rows written
--    before the app priced them itself (20261015143608 added the column).
--    The rates are a snapshot of lib/ai/cost/pricing.ts on 2026-10-15; this
--    file is not kept in sync with later rate changes. Claude cache writes were
--    not counted before this change (cache_write_tokens is 0 on old rows), so
--    an old Claude row's cost misses the 1.25x write premium on those tokens.
--    Rows stay NULL — unknown, never zero — when the model is not on the card,
--    when the row is the per-analysis reservation (request_count = 1), or
--    when the attempt reported no tokens.
UPDATE public.analysis_model_budget_events AS e
SET cost_usd = round((
    (e.input_tokens - e.cached_tokens) * r.input_rate
    + e.cached_tokens * r.cached_rate
    + (e.output_tokens + e.thought_tokens) * r.output_rate
  ) / 1e6, 8)
FROM (VALUES
  ('gemini-3.1-flash-lite', 0.25, 0.025, 1.50),
  ('gemini-3.5-flash-lite', 0.30, 0.03, 2.50),
  ('gemini-3.6-flash', 0.75, 0.075, 3.75),
  ('gemini-3-flash-preview', 0.50, 0.05, 3.00),
  ('gemini-2.5-flash-lite', 0.10, 0.01, 0.40),
  ('gemini-2.5-flash', 0.30, 0.03, 2.50),
  ('claude-haiku-5-5', 0.10, 0.01, 0.50)
) AS r(model, input_rate, cached_rate, output_rate)
WHERE e.model = r.model
  AND e.request_count = 0
  AND e.cost_usd IS NULL
  AND e.input_tokens + e.output_tokens + e.thought_tokens > 0;

-- 2. Append the cost inputs and the new columns to the allowlisted view.
--    CREATE OR REPLACE may only add columns at the end, and keeps the view's
--    grants (analytics_reader) and comment.
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
    be.error_category,
    be.cached_tokens,
    be.thought_tokens,
    be.cache_write_tokens,
    be.cost_usd,
    be.latency_ms,
    be.fallback_from
FROM public.analysis_model_budget_events AS be;
