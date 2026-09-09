begin;

-- Supabase drilldowns use the same four controls as the AWS and Google
-- sources. Because these tables are date-bucketed, 24h means the latest UTC
-- observation day anchored to production data.
create or replace function analytics.range_from(p_range text)
returns date language sql stable set search_path = public, pg_temp as $$
  select case p_range
    when '24h' then analytics.anchor_date()
    when '7d'  then analytics.anchor_date() - 6
    when '30d' then analytics.anchor_date() - 29
    when '90d' then analytics.anchor_date() - 89
    else least(
      coalesce((select min(created_at)::date from public.pipeline_requests), analytics.anchor_date()),
      coalesce((select min(logged_at)::date  from public.meals), analytics.anchor_date()),
      coalesce((select min(created_at)::date from public.user_profiles), analytics.anchor_date()))
  end;
$$;

commit;
