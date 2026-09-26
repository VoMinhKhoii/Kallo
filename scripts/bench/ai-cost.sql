-- AI spend from analysis_model_budget_events — the always-on, prod-written
-- table (one row per LLM attempt, plus one 0-token request-count row per meal
-- analysis). Read-only; run with psql against the target project.
--
-- Rates mirror lib/ai/cost/pricing.ts (USD per 1M tokens); pricing.test.ts
-- fails if a rates block drifts from it. Unknown models price as NULL, never
-- as zero.
--
--   cached_tokens  ⊂ input_tokens, billed at the cached rate
--   thought_tokens   billed at the output rate, on top of output_tokens
--
-- Window: edit the interval in `params`.

\echo '== 1. Daily spend by route and model'
with params as (select now() - interval '30 days' as since),
rates(model, input_rate, cached_rate, output_rate) as (values
  ('gemini-3.1-flash-lite', 0.25, 0.025, 1.50),
  ('gemini-3.5-flash-lite', 0.30, 0.03, 2.50),
  ('gemini-3.6-flash', 0.75, 0.075, 3.75),
  ('gemini-3-flash-preview', 0.50, 0.05, 3.00),
  ('gemini-2.5-flash-lite', 0.10, 0.01, 0.40),
  ('gemini-2.5-flash', 0.30, 0.03, 2.50)),
priced as (
  select e.*, (
    (e.input_tokens - e.cached_tokens) * r.input_rate
    + e.cached_tokens * r.cached_rate
    + (e.output_tokens + e.thought_tokens) * r.output_rate
  ) / 1e6 as usd
  from analysis_model_budget_events e
  left join rates r using (model)
  where e.created_at >= (select since from params)
)
select date_trunc('day', created_at)::date as day, route, model,
  count(*) filter (where request_count = 0) as llm_attempts,
  sum(input_tokens) as input_tok, sum(cached_tokens) as cached_tok,
  sum(output_tokens) as output_tok, sum(thought_tokens) as thought_tok,
  round(sum(usd)::numeric, 4) as usd
from priced group by 1, 2, 3 order by 1 desc, usd desc nulls first;

\echo '== 2. Per meal analysis (grouped by request_id)'
with params as (select now() - interval '30 days' as since),
rates(model, input_rate, cached_rate, output_rate) as (values
  ('gemini-3.1-flash-lite', 0.25, 0.025, 1.50),
  ('gemini-3.5-flash-lite', 0.30, 0.03, 2.50),
  ('gemini-3.6-flash', 0.75, 0.075, 3.75),
  ('gemini-3-flash-preview', 0.50, 0.05, 3.00),
  ('gemini-2.5-flash-lite', 0.10, 0.01, 0.40),
  ('gemini-2.5-flash', 0.30, 0.03, 2.50)),
per_request as (
  select e.request_id, e.route,
    count(*) filter (where e.request_count = 0) as attempts,
    count(*) filter (where e.error_category is not null) as errors,
    sum(e.input_tokens) as input_tok, sum(e.output_tokens + e.thought_tokens) as output_tok,
    sum((
      (e.input_tokens - e.cached_tokens) * r.input_rate
      + e.cached_tokens * r.cached_rate
      + (e.output_tokens + e.thought_tokens) * r.output_rate
    ) / 1e6) as usd
  from analysis_model_budget_events e
  left join rates r using (model)
  where e.created_at >= (select since from params) and e.request_id is not null
  group by 1, 2
)
select route, count(*) as analyses,
  round(avg(attempts), 2) as attempts_per_analysis,
  round(avg(input_tok)) as input_tok, round(avg(output_tok)) as output_tok,
  round(avg(usd)::numeric, 5) as usd_per_analysis,
  round((percentile_cont(0.9) within group (order by usd))::numeric, 5) as p90_usd,
  round(sum(usd)::numeric, 4) as total_usd,
  count(*) filter (where errors > 0) as analyses_with_errors
from per_request group by 1 order by total_usd desc nulls first;

\echo '== 3. Implicit cache effectiveness'
select model,
  count(*) filter (where request_count = 0) as attempts,
  count(*) filter (where cached_tokens > 0) as cache_hits,
  round(sum(cached_tokens)::numeric / nullif(sum(input_tokens), 0), 3) as cached_share,
  round(sum(thought_tokens)::numeric / nullif(sum(output_tokens + thought_tokens), 0), 3) as thought_share
from analysis_model_budget_events
where created_at >= now() - interval '30 days'
group by 1;
