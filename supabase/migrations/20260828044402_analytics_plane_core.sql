
create schema if not exists analytics;

-- One row per ingredient verdict, joined to the candidate pool stage 2 emitted.
-- The join is positional (ingredientIndex); validated at 827/831 on prod.
create or replace view analytics.v_verdict_pool as
with v as (
  select l.id as log_id, l.request_id, l.created_at,
         (vv->>'verdict')                        as verdict,
         nullif(vv->>'selectedCandidateIdx','')::int as sel,
         row_number() over (
           partition by l.id
           order by (vv->>'mealItemIdx')::int, (vv->>'ingredientIdx')::int
         ) - 1                                   as gidx,
         vv->'grounded'->>'ingredientName'       as ing_name,
         vv->>'rejectReason'                     as reject_reason
  from public.pipeline_stage_logs l,
       lateral jsonb_array_elements(l.output_json->'bridged'->'verdicts') vv
  where l.stage = 'assembly' and l.output_json ? 'bridged'
),
p as (
  select l.request_id,
         (e->>'ingredientIndex')::int       as gidx,
         e->'candidates'                    as cands,
         jsonb_array_length(e->'candidates') as pool
  from public.pipeline_stage_logs l,
       lateral jsonb_array_elements(l.output_json) e
  where l.stage = 'matching' and jsonb_typeof(l.output_json) = 'array'
)
select v.request_id, v.created_at::date as d, v.verdict, v.sel, v.gidx,
       v.ing_name, v.reject_reason,
       coalesce(p.pool, 0) as pool, p.cands
from v left join p on p.request_id = v.request_id and p.gidx = v.gidx;

-- One row per shipped match.
create or replace view analytics.v_matches as
select l.request_id, l.created_at::date as d,
       mm->>'foodCompositionId' as fcid,
       mm->>'matchedName'       as matched_name,
       mm->>'source'            as src,
       mm->>'ingredientName'    as q,
       (mm->>'similarity')::numeric as similarity
from public.pipeline_stage_logs l,
     lateral jsonb_array_elements(l.output_json->'bridged'->'matched') mm
where l.stage = 'assembly' and l.output_json ? 'bridged';

create or replace view analytics.v_unmatched as
select l.request_id, l.created_at::date as d, uu->>'ingredientName' as nm
from public.pipeline_stage_logs l,
     lateral jsonb_array_elements(l.output_json->'bridged'->'unmatched') uu
where l.stage = 'assembly' and l.output_json ? 'bridged';

-- The anchor every range is measured back from: the latest day that has data,
-- not today. A dev database that stopped receiving traffic last week must not
-- render every panel empty.
create or replace function analytics.anchor_date()
returns date language sql stable set search_path = public, pg_temp as $$
  select greatest(
    coalesce((select max(created_at)::date from public.pipeline_requests), '2000-01-01'::date),
    coalesce((select max(logged_at)::date  from public.meals), '2000-01-01'::date)
  );
$$;

create or replace function analytics.range_from(p_range text)
returns date language sql stable set search_path = public, pg_temp as $$
  select case p_range
    when '7d'  then analytics.anchor_date() - 6
    when '30d' then analytics.anchor_date() - 29
    when '90d' then analytics.anchor_date() - 89
    else '2000-01-01'::date
  end;
$$;
