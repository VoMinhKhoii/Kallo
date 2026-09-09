begin;

-- Keep the trace useful without turning the operator console into a raw-data
-- browser. Keys that can carry prompts, model wire responses, credentials, or
-- actor identifiers are removed recursively. Deep or unusually large values
-- are bounded before PostgREST can return them.
create or replace function analytics.sanitize_trace_output(p_value jsonb, p_depth int default 0)
returns jsonb language plpgsql immutable strict set search_path = public, pg_temp as $$
declare
  value_type text;
  sanitized jsonb;
begin
  if p_depth >= 7 then
    return to_jsonb('[depth limit]'::text);
  end if;

  value_type := jsonb_typeof(p_value);
  if value_type = 'object' then
    select coalesce(
      jsonb_object_agg(entry.key, analytics.sanitize_trace_output(entry.value, p_depth + 1) order by entry.key),
      '{}'::jsonb
    )
    into sanitized
    from jsonb_each(p_value) entry
    where entry.key !~* '(prompt|response.?raw|raw.?response|user.?id|session.?id|actor.?id|request.?context|authorization|email)';
    return sanitized;
  elsif value_type = 'array' then
    select coalesce(
      jsonb_agg(analytics.sanitize_trace_output(item.value, p_depth + 1) order by item.ordinality),
      '[]'::jsonb
    )
    into sanitized
    from jsonb_array_elements(p_value) with ordinality item(value, ordinality)
    where item.ordinality <= 50;
    return sanitized;
  elsif value_type = 'string' then
    return to_jsonb(left(p_value #>> '{}', 1000));
  end if;

  return p_value;
end;
$$;

create or replace function analytics.trace_detail(p_request_id uuid, p_raw_limit int default 4000)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with request_row as (
    select id, status, duration_ms, created_at
    from public.pipeline_requests
    where id = p_request_id
  ),
  stages as (
    select id, stage, stage_index, status, duration_ms, output_json, error
    from public.pipeline_stage_logs
    where request_id = p_request_id
  ),
  spans_calc as (
    select id, stage, stage_index, status, coalesce(duration_ms, 0) dur,
           coalesce(sum(duration_ms) over (
             order by stage_index rows between unbounded preceding and 1 preceding
           ), 0) as start_ms
    from stages
  ),
  final_decomposition as (
    select output_json
    from stages
    where stage = 'decomposition' and status = 'success'
    order by stage_index desc
    limit 1
  ),
  final_assembly as (
    select output_json
    from stages
    where stage = 'assembly' and status = 'success'
    order by stage_index desc
    limit 1
  ),
  vp as (
    select * from analytics.v_verdict_pool where request_id = p_request_id
  ),
  first_ovr as (
    select ing_name, cands, sel from vp
    where verdict = 'accepted' and sel > 0 and cands is not null
    order by gidx limit 1
  )
  select jsonb_build_object(
    'requestId', p_request_id,
    'startedAt', (select created_at from request_row),
    'total', coalesce(
      (select duration_ms from request_row),
      (select sum(dur) from spans_calc),
      0
    ),
    'meal', (
      select string_agg(item->>'name', ' · ' order by ord)
      from final_assembly,
           lateral jsonb_array_elements(output_json->'result'->'mealItems')
             with ordinality meal(item, ord)
    ),
    'status', (select status from request_row),
    'spans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', id::text,
        'name', stage,
        'index', stage_index,
        'dur', dur,
        'start', start_ms,
        'ok', status is distinct from 'error'
      ) order by stage_index)
      from spans_calc
    ), '[]'::jsonb),
    'stageOutputs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', id::text,
        'name', stage,
        'index', stage_index,
        'status', status,
        'durationMs', coalesce(duration_ms, 0),
        'output', case when output_json is null then null else analytics.sanitize_trace_output(output_json) end
      ) order by stage_index)
      from stages
      where stage in ('decomposition', 'matching', 'nutrition', 'assembly')
    ), '[]'::jsonb),
    'counts', (
      select jsonb_build_object(
        'ingredients', count(*),
        'accepted', count(*) filter (where verdict = 'accepted'),
        'unmatched', count(*) filter (where verdict = 'unmatched'),
        'rejected', count(*) filter (where verdict = 'rejected')
      )
      from vp
    ),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_array(
        ing_name,
        case when pool = 0 then 'no candidates'
             when sel is null then 'model rejected all'
             else cands->sel->'info'->>'matchedName' end,
        pool,
        case when sel is null then '—' else 'c' || (sel + 1) end,
        verdict
      ) order by gidx)
      from vp
    ), '[]'::jsonb),
    'ovr', (
      select jsonb_build_object(
        'ing', ing_name,
        'rank', sel + 1,
        'pool', (
          select jsonb_agg(jsonb_build_array(
            candidate->'info'->>'matchedName',
            candidate->'info'->>'source',
            candidate->'info'->>'matchType',
            to_char(round((candidate->'info'->>'similarity')::numeric, 4), 'FM0.0000'),
            candidate->'nutrition'->>'fatG',
            candidate->'nutrition'->>'caloriesKcal'
          ) order by ord)
          from jsonb_array_elements(first_ovr.cands) with ordinality x(candidate, ord)
        )
      )
      from first_ovr
    ),
    'decomposition', coalesce(
      (select output_json from final_decomposition),
      '{}'::jsonb
    ),
    'analysis', coalesce(
      (select output_json->'result' from final_assembly),
      '{}'::jsonb
    ),
    'modelCalls', coalesce((
      select jsonb_agg(jsonb_build_object(
        'stage', coalesce(stage.stage, 'unknown'),
        'model', call.model,
        'attempt', call.attempt,
        'latencyMs', call.latency_ms,
        'inputTokens', coalesce(call.input_tokens, 0),
        'outputTokens', coalesce(call.output_tokens, 0),
        'ok', call.error is null,
        'error', case when call.error is null then null else left(call.error, 300) end
      ) order by call.created_at)
      from public.pipeline_llm_calls call
      left join stages stage on stage.id = call.stage_log_id
      where call.request_id = p_request_id
    ), '[]'::jsonb)
  );
$$;

comment on function analytics.sanitize_trace_output(jsonb, int) is
  'Recursively bounds one structured stage output and removes prompt, raw-response, and actor fields.';
comment on function analytics.trace_detail(uuid, int) is
  'Bounded operator trace with interpretable stage outputs; excludes raw prompts, responses, actor identifiers, and request context.';

commit;
