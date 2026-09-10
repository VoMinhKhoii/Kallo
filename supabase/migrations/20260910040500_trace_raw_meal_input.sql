begin;

-- The analytics console is a private, server-authenticated operator surface.
-- Return only the bounded meal text that the person entered. User/session ids,
-- request context, prompts, and model wire responses remain excluded.
create or replace function public.analytics_requests_page(
  p_range text,
  p_limit int default 12,
  p_offset int default 0
)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with base as (
    select analytics.requests_page(p_range, p_limit, p_offset) payload
  ),
  rewritten_rows as (
    select row.ordinality,
           jsonb_set(
             row.value,
             '{3}',
             to_jsonb(coalesce(left(request.raw_input, 240), row.value->>3, '—')),
             true
           ) value
    from base,
         lateral jsonb_array_elements(base.payload->'rows') with ordinality row(value, ordinality)
    left join public.pipeline_requests request on request.id = (row.value->>9)::uuid
  )
  select jsonb_set(
    base.payload,
    '{rows}',
    coalesce((select jsonb_agg(value order by ordinality) from rewritten_rows), '[]'::jsonb),
    true
  )
  from base;
$$;

create or replace function public.analytics_trace_detail(
  p_request_id uuid,
  p_raw_limit int default 4000
)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select analytics.trace_detail(p_request_id, p_raw_limit)
    || jsonb_build_object(
      'rawInput',
      left(request.raw_input, least(greatest(coalesce(p_raw_limit, 4000), 1), 4000))
    )
  from public.pipeline_requests request
  where request.id = p_request_id;
$$;

comment on function public.analytics_requests_page(text, int, int) is
  'Private operator trace list with bounded original meal text; excludes actor and request context.';
comment on function public.analytics_trace_detail(uuid, int) is
  'Private bounded trace with original meal text; excludes actor ids, request context, prompts, and wire responses.';

revoke all on function public.analytics_requests_page(text, int, int) from public, anon, authenticated;
revoke all on function public.analytics_trace_detail(uuid, int) from public, anon, authenticated;
grant execute on function public.analytics_requests_page(text, int, int) to service_role;
grant execute on function public.analytics_trace_detail(uuid, int) to service_role;

commit;
