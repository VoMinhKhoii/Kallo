
create or replace function analytics.trace_detail(p_request_id uuid, p_raw_limit int default 4000)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with stages as (
    select stage, status, duration_ms, output_json,
           case stage when 'decomposition' then 1 when 'matching' then 2
                      when 'nutrition' then 3 when 'assembly' then 4 else 5 end ord
    from public.pipeline_stage_logs where request_id = p_request_id),
  spans_calc as (
    select stage, status, coalesce(duration_ms, 0) dur, ord,
           coalesce(sum(duration_ms) over (order by ord
             rows between unbounded preceding and 1 preceding), 0) as start_ms
    from stages),
  vp as (select * from analytics.v_verdict_pool where request_id = p_request_id),
  first_ovr as (
    select ing_name, cands, sel from vp
    where verdict = 'accepted' and sel > 0 and cands is not null
    order by gidx limit 1)
  select jsonb_build_object(
    'requestId', p_request_id,
    'total', (select coalesce(sum(dur), 0) from spans_calc),
    'meal', (select string_agg(mi.v->>'name', ' · ' order by mi.ord)
             from stages s, lateral jsonb_array_elements(s.output_json->'mealItems') with ordinality mi(v, ord)
             where s.stage = 'decomposition'),
    'status', (select status from public.pipeline_requests where id = p_request_id),
    'spans', coalesce((select jsonb_agg(jsonb_build_object(
                'key', stage, 'name', stage, 'dur', dur, 'start', start_ms,
                'ok', status is distinct from 'error') order by ord)
              from spans_calc), '[]'::jsonb),
    'counts', (select jsonb_build_object(
                 'ingredients', count(*),
                 'accepted',  count(*) filter (where verdict='accepted'),
                 'unmatched', count(*) filter (where verdict='unmatched'),
                 'rejected',  count(*) filter (where verdict='rejected')) from vp),
    'rows', coalesce((select jsonb_agg(jsonb_build_array(
                ing_name,
                case when pool = 0 then 'no candidates'
                     when sel is null then 'model rejected all'
                     else cands->sel->'info'->>'matchedName' end,
                pool,
                case when sel is null then '—' else 'c' || (sel + 1) end,
                verdict) order by gidx)
              from vp), '[]'::jsonb),
    'ovr', (select jsonb_build_object(
              'ing', ing_name, 'rank', sel + 1,
              'pool', (select jsonb_agg(jsonb_build_array(
                         c->'info'->>'matchedName', c->'info'->>'source', c->'info'->>'matchType',
                         to_char(round((c->'info'->>'similarity')::numeric, 4), 'FM0.0000'),
                         c->'nutrition'->>'fatG', c->'nutrition'->>'caloriesKcal') order by ord)
                       from jsonb_array_elements(first_ovr.cands) with ordinality x(c, ord)))
            from first_ovr),
    'raw', coalesce((select jsonb_object_agg(stage,
                       left(jsonb_pretty(output_json), greatest(coalesce(p_raw_limit, 4000), 500)))
                     from stages), '{}'::jsonb));
$$;

revoke all on schema analytics from anon, authenticated;
revoke all on all functions in schema analytics from anon, authenticated;
revoke all on all tables in schema analytics from anon, authenticated;
