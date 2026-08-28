
-- Whole-page summary for one range, in ONE round trip. Returns scalars and
-- small fixed-size arrays only; nothing here grows with traffic.
create or replace function analytics.summary(p_range text)
returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare
  f date := analytics.range_from(p_range);
  a date := analytics.anchor_date();
  app jsonb; ai jsonb;
begin
  select jsonb_build_object(
    'from', f, 'to', a,
    'newUsers', (select count(*) from public.user_profiles where created_at::date >= f),
    'active',   (select count(distinct user_id) from public.meals where logged_at::date >= f),
    'meals',    (select count(*) from public.meals where logged_at::date >= f),
    'items',    (select count(*) from public.meal_items where created_at::date >= f),
    'reqs',     (select count(*) from public.pipeline_requests where created_at::date >= f),
    'ok',       (select count(*) from public.pipeline_requests where created_at::date >= f and status = 'success'),
    'err',      (select count(*) from public.pipeline_requests where created_at::date >= f and status = 'error'),
    'pend',     (select count(*) from public.pipeline_requests where created_at::date >= f and status not in ('success','error')),
    'waitlist', (select count(*) from public.waitlist_signups where created_at::date >= f),
    'everLogged', (select count(distinct user_id) from public.meals),
    'registered', (select count(*) from public.user_profiles),
    'slots',    coalesce((select jsonb_agg(jsonb_build_array(slot, c) order by c desc)
                          from (select coalesce(meal_slot,'(unset)') slot, count(*) c
                                from public.meals where logged_at::date >= f group by 1) t), '[]'::jsonb),
    'modes',    coalesce((select jsonb_agg(jsonb_build_array(mode, c) order by c desc)
                          from (select coalesce(entry_mode,'(unset)') mode, count(*) c
                                from public.meals where logged_at::date >= f group by 1) t), '[]'::jsonb),
    'conc',     coalesce((select jsonb_agg(jsonb_build_array(b, n) order by ord)
                          from (select case when c = 1 then '1' when c <= 3 then '2-3' when c <= 9 then '4-9'
                                             when c <= 29 then '10-29' else '30+' end b,
                                       case when c = 1 then 1 when c <= 3 then 2 when c <= 9 then 3
                                             when c <= 29 then 4 else 5 end ord,
                                       count(*) n
                                from (select user_id, count(*) c from public.meals group by 1) pu
                                group by 1, 2) z), '[]'::jsonb),
    'heavyTwo', (select coalesce(sum(c), 0) from (select count(*) c from public.meals group by user_id order by c desc limit 2) h)
  ) into app;

  with vp as (select * from analytics.v_verdict_pool where d >= f),
       mt as (select * from analytics.v_matches       where d >= f),
       um as (select * from analytics.v_unmatched     where d >= f),
       st as (select stage, duration_ms from public.pipeline_stage_logs
              where duration_ms is not null and created_at::date >= f)
  select jsonb_build_object(
    'from', f, 'to', a,
    'meals',    (select count(distinct request_id) from vp),
    'verdicts', (select count(*) from vp),
    'acc', (select count(*) filter (where verdict='accepted')  from vp),
    'unm', (select count(*) filter (where verdict='unmatched') from vp),
    'rej', (select count(*) filter (where verdict='rejected')  from vp),
    'mis', (select count(*) filter (where verdict='missing')   from vp),
    'pool', (select jsonb_build_array(
               count(*) filter (where pool=0), count(*) filter (where pool=1),
               count(*) filter (where pool=2), count(*) filter (where pool=3)) from vp),
    'choice', (select count(*) filter (where verdict='accepted' and pool>1) from vp),
    'ovr',    (select count(*) filter (where verdict='accepted' and pool>1 and sel>0) from vp),
    'a2', (select count(*) filter (where verdict='accepted' and pool=2) from vp),
    'o2', (select count(*) filter (where verdict='accepted' and pool=2 and sel>0) from vp),
    'a3', (select count(*) filter (where verdict='accepted' and pool=3) from vp),
    'o3', (select count(*) filter (where verdict='accepted' and pool=3 and sel>0) from vp),
    'degraded', (select count(distinct request_id) filter (where verdict <> 'accepted') from vp),
    'sim', (select jsonb_build_object('n', count(*), 'bins', jsonb_build_array(
              count(*) filter (where similarity >= 0.70 and similarity < 0.75),
              count(*) filter (where similarity >= 0.75 and similarity < 0.80),
              count(*) filter (where similarity >= 0.80 and similarity < 0.85),
              count(*) filter (where similarity >= 0.85 and similarity < 0.90),
              count(*) filter (where similarity >= 0.90 and similarity < 0.95),
              count(*) filter (where similarity >= 0.95 and similarity < 1),
              count(*) filter (where similarity = 1),
              count(*) filter (where similarity > 1))) from mt),
    'stages', coalesce((select jsonb_agg(jsonb_build_array(stage, p50, p95, n) order by ord)
                        from (select stage,
                                     percentile_disc(0.5) within group (order by duration_ms) p50,
                                     percentile_disc(0.95) within group (order by duration_ms) p95,
                                     count(*) n,
                                     case stage when 'decomposition' then 1 when 'matching' then 2
                                                when 'nutrition' then 3 else 4 end ord
                              from st group by stage) s), '[]'::jsonb),
    'matchP95', coalesce((select percentile_disc(0.95) within group (order by duration_ms)
                          from st where stage = 'matching'), 0),
    'reasons', (select jsonb_build_object(
                  'n', count(*),
                  'nul',   count(*) filter (where reject_reason is null),
                  'none',  count(*) filter (where reject_reason = 'none'),
                  'cat',   count(*) filter (where reject_reason like 'category mismatch%'),
                  'other', count(*) filter (where reject_reason is not null
                                             and reject_reason <> 'none'
                                             and reject_reason not like 'category mismatch%'))
                from vp where verdict <> 'accepted'),
    'rowsUsed', (select count(distinct fcid) from mt),
    'matches',  (select count(*) from mt),
    'corpusSize', (select count(*) from public.vietnamese_food_composition),
    'unmN', (select count(*) from um),
    'unmDistinct', (select count(distinct nm) from um),
    'ovrPairs', (select count(*) from (
        select cands->0->'info'->>'matchedName' t1,
               cands->sel->'info'->>'matchedName' ch, sel
        from vp where verdict='accepted' and sel>0 and cands is not null
        group by 1,2,3) z)
  ) into ai;

  return jsonb_build_object('anchor', a, 'range', p_range, 'app', app, 'ai', ai);
end;
$$;

-- Weekly series for both planes. Bounded by the data's own span.
create or replace function analytics.weeks()
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with app as (
    select date_trunc('week', logged_at)::date w, count(distinct user_id) au, count(*) ml
    from public.meals group by 1),
  sig as (select date_trunc('week', created_at)::date w, count(*) n from public.user_profiles group by 1),
  req as (select date_trunc('week', created_at)::date w, count(*) n,
                 count(*) filter (where status='error') e
          from public.pipeline_requests group by 1),
  ai as (select date_trunc('week', d::timestamp)::date w,
                count(distinct request_id) reqs, count(*) ing,
                count(*) filter (where verdict='accepted') acc,
                count(*) filter (where pool=0) pool0,
                count(*) filter (where verdict='accepted' and pool>1) choice,
                count(*) filter (where verdict='accepted' and pool>1 and sel>0) ovr
         from analytics.v_verdict_pool group by 1),
  span as (
    select generate_series(
      least((select min(w) from app), (select min(w) from sig), (select min(w) from req)),
      (select date_trunc('week', analytics.anchor_date()::timestamp)::date),
      interval '1 week')::date w)
  select jsonb_build_object(
    'app', coalesce(jsonb_agg(jsonb_build_array(
              to_char(span.w,'MM-DD'), app.au, app.ml, sig.n, req.n, req.e) order by span.w), '[]'::jsonb),
    'ai',  coalesce(jsonb_agg(jsonb_build_object(
              'w', to_char(span.w,'MM-DD'), 'reqs', ai.reqs, 'ing', ai.ing, 'acc', ai.acc,
              'pool0', ai.pool0, 'choice', ai.choice, 'ovr', ai.ovr) order by span.w), '[]'::jsonb),
    'aiFirstWeek', (select min(w) from ai))
  from span
  left join app on app.w = span.w
  left join sig on sig.w = span.w
  left join req on req.w = span.w
  left join ai  on ai.w  = span.w;
$$;
