
-- Every list endpoint is paginated and hard-capped, so no single call can scan
-- or return an unbounded set however the caller is configured.
create or replace function analytics._cap(p_limit int)
returns int language sql immutable as $$ select least(greatest(coalesce(p_limit, 20), 1), 200); $$;

create or replace function analytics.overturn_groups(p_range text, p_limit int default 10, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with o as (
    select ing_name q, sel + 1 rnk, cands
    from analytics.v_verdict_pool
    where d >= analytics.range_from(p_range) and verdict = 'accepted' and sel > 0 and cands is not null),
  g as (select q, rnk, count(*) n, min(cands::text) sample from o group by 1, 2)
  select jsonb_build_object(
    'total', (select count(*) from g),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'q', q, 'rank', rnk, 'n', n,
        'top1', (sample::jsonb)->0->'info'->>'matchedName') order by n desc, q)
      from (select * from g order by n desc, q limit analytics._cap(p_limit) offset greatest(coalesce(p_offset,0),0)) pg), '[]'::jsonb));
$$;

-- One real request's pool for a (query, chosen-rank) group.
create or replace function analytics.overturn_pool(p_query text, p_rank int, p_range text)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select coalesce((
    select jsonb_build_object(
      'q', p_query, 'rank', p_rank,
      'pool', (select jsonb_agg(jsonb_build_array(
                 c->'info'->>'matchedName', c->'info'->>'source', c->'info'->>'matchType',
                 to_char(round((c->'info'->>'similarity')::numeric, 3), 'FM0.000'),
                 c->'nutrition'->>'caloriesKcal', c->'nutrition'->>'fatG',
                 c->'nutrition'->>'proteinG', c->'nutrition'->>'carbohydrateG') order by ord)
               from jsonb_array_elements(vp.cands) with ordinality x(c, ord)))
    from analytics.v_verdict_pool vp
    where vp.d >= analytics.range_from(p_range) and vp.verdict = 'accepted'
      and vp.sel + 1 = p_rank and vp.ing_name = p_query and vp.cands is not null
    order by vp.request_id limit 1), '{}'::jsonb);
$$;

create or replace function analytics.reverse_rows(p_range text, p_limit int default 14, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with o as (
    select cands->0->'info' t1, cands->sel->'info' ch, ing_name q
    from analytics.v_verdict_pool
    where d >= analytics.range_from(p_range) and verdict = 'accepted' and sel > 0 and cands is not null),
  side as (
    select 'r' s, t1->>'foodCompositionId' f, t1->>'matchedName' nm, t1->>'source' sr, q from o
    union all
    select 'w', ch->>'foodCompositionId', ch->>'matchedName', ch->>'source', q from o),
  agg as (
    select f, max(nm) nm, max(sr) sr,
           count(*) filter (where s='r') rj, count(*) filter (where s='w') wn
    from side group by f)
  select jsonb_build_object(
    'total', (select count(*) from agg),
    'bothSided', (select count(*) from agg where rj > 0 and wn > 0),
    'rows', coalesce((select jsonb_agg(jsonb_build_array(
        pg.f, pg.nm, pg.sr, pg.rj, pg.wn,
        coalesce((select jsonb_agg(jsonb_build_array(q2, n2) order by n2 desc)
                  from (select q q2, count(*) n2 from side where side.f = pg.f and side.s='r'
                        group by 1 order by 2 desc limit 5) a), '[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_array(q2, n2) order by n2 desc)
                  from (select q q2, count(*) n2 from side where side.f = pg.f and side.s='w'
                        group by 1 order by 2 desc limit 5) b), '[]'::jsonb))
        order by pg.rj + pg.wn desc, pg.f)
      from (select * from agg order by rj + wn desc, f
            limit analytics._cap(p_limit) offset greatest(coalesce(p_offset,0),0)) pg), '[]'::jsonb));
$$;

create or replace function analytics.corpus_rows(p_range text, p_limit int default 12, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with m as (select * from analytics.v_matches where d >= analytics.range_from(p_range)),
       agg as (select fcid, max(matched_name) nm, max(src) src, count(*) n, count(distinct q) dq from m group by fcid)
  select jsonb_build_object(
    'total', (select count(*) from agg),
    'singletons', (select count(*) from agg where n = 1),
    'rows', coalesce((select jsonb_agg(jsonb_build_array(fcid, nm, src, n, dq) order by n desc, fcid)
      from (select * from agg order by n desc, fcid
            limit analytics._cap(p_limit) offset greatest(coalesce(p_offset,0),0)) pg), '[]'::jsonb));
$$;

create or replace function analytics.corpus_queries(p_fcid text, p_range text, p_limit int default 10, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with m as (select q from analytics.v_matches
             where d >= analytics.range_from(p_range) and fcid = p_fcid),
       agg as (select q, count(*) n from m group by q)
  select jsonb_build_object(
    'total', (select count(*) from agg),
    'rows', coalesce((select jsonb_agg(jsonb_build_array(q, n) order by n desc, q)
      from (select * from agg order by n desc, q
            limit analytics._cap(p_limit) offset greatest(coalesce(p_offset,0),0)) pg), '[]'::jsonb));
$$;

create or replace function analytics.pool_names(p_range text, p_pool int, p_limit int default 40, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with n as (
    select distinct coalesce(cands->0->'info'->>'ingredientName', ing_name) nm
    from analytics.v_verdict_pool
    where d >= analytics.range_from(p_range) and pool = p_pool)
  select jsonb_build_object(
    'total', (select count(*) from n),
    'rows', coalesce((select jsonb_agg(nm order by nm)
      from (select nm from n where nm is not null order by nm
            limit analytics._cap(p_limit) offset greatest(coalesce(p_offset,0),0)) pg), '[]'::jsonb));
$$;

create or replace function analytics.unresolved(p_range text, p_limit int default 10, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with u as (select nm from analytics.v_unmatched where d >= analytics.range_from(p_range)),
       agg as (select nm, count(*) n from u group by nm)
  select jsonb_build_object(
    'total', (select count(*) from agg),
    'rows', coalesce((select jsonb_agg(jsonb_build_array(nm, n) order by n desc, nm)
      from (select * from agg order by n desc, nm
            limit analytics._cap(p_limit) offset greatest(coalesce(p_offset,0),0)) pg), '[]'::jsonb));
$$;

create or replace function analytics.requests_page(p_range text, p_limit int default 12, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with a as (
    select l.request_id, l.created_at,
           jsonb_array_length(l.output_json->'bridged'->'verdicts') n,
           (select count(*) from jsonb_array_elements(l.output_json->'bridged'->'verdicts') v
            where v->>'verdict'='accepted') acc,
           (select count(*) from jsonb_array_elements(l.output_json->'bridged'->'verdicts') v
            where v->>'verdict'='unmatched') unm,
           (select count(*) from jsonb_array_elements(l.output_json->'bridged'->'verdicts') v
            where v->>'verdict'='rejected') rej
    from public.pipeline_stage_logs l
    where l.stage='assembly' and l.output_json ? 'bridged'
      and l.created_at::date >= analytics.range_from(p_range)),
  dc as (
    select l.request_id, string_agg(mi.v->>'name', ' · ' order by mi.ord) items
    from public.pipeline_stage_logs l,
         lateral jsonb_array_elements(l.output_json->'mealItems') with ordinality mi(v, ord)
    where l.stage='decomposition' and l.output_json ? 'mealItems'
    group by 1)
  select jsonb_build_object(
    'total', (select count(*) from a),
    'rows', coalesce((select jsonb_agg(jsonb_build_array(
        left(pg.request_id::text, 8), to_char(pg.created_at, 'YYYY-MM-DD'), to_char(pg.created_at, 'HH24:MI'),
        coalesce(left(dc.items, 80), '—'), q.duration_ms, pg.n, pg.acc, pg.unm, pg.rej, pg.request_id::text)
        order by pg.created_at desc)
      from (select * from a order by created_at desc
            limit analytics._cap(p_limit) offset greatest(coalesce(p_offset,0),0)) pg
      left join dc on dc.request_id = pg.request_id
      left join public.pipeline_requests q on q.id = pg.request_id), '[]'::jsonb));
$$;
