
-- "All" was reporting the sentinel 2000-01-01 as its start date. Floor it to
-- the first day that actually has data so the header states a real span.
create or replace function analytics.range_from(p_range text)
returns date language sql stable set search_path = public, pg_temp as $$
  select case p_range
    when '7d'  then analytics.anchor_date() - 6
    when '30d' then analytics.anchor_date() - 29
    when '90d' then analytics.anchor_date() - 89
    else least(
      coalesce((select min(created_at)::date from public.pipeline_requests), analytics.anchor_date()),
      coalesce((select min(logged_at)::date  from public.meals), analytics.anchor_date()),
      coalesce((select min(created_at)::date from public.user_profiles), analytics.anchor_date()))
  end;
$$;
