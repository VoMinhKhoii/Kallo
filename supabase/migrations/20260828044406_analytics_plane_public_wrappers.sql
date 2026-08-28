
-- PostgREST only exposes `public`, so these thin wrappers are the API surface.
-- Each is revoked from anon/authenticated: only the server-held key can call
-- them, so the browser never talks to the database directly.
create or replace function public.analytics_summary(p_range text)
returns jsonb language sql stable set search_path = public, pg_temp as $$ select analytics.summary(p_range); $$;

create or replace function public.analytics_weeks()
returns jsonb language sql stable set search_path = public, pg_temp as $$ select analytics.weeks(); $$;

create or replace function public.analytics_overturn_groups(p_range text, p_limit int default 10, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$ select analytics.overturn_groups(p_range, p_limit, p_offset); $$;

create or replace function public.analytics_overturn_pool(p_query text, p_rank int, p_range text)
returns jsonb language sql stable set search_path = public, pg_temp as $$ select analytics.overturn_pool(p_query, p_rank, p_range); $$;

create or replace function public.analytics_reverse_rows(p_range text, p_limit int default 14, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$ select analytics.reverse_rows(p_range, p_limit, p_offset); $$;

create or replace function public.analytics_corpus_rows(p_range text, p_limit int default 12, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$ select analytics.corpus_rows(p_range, p_limit, p_offset); $$;

create or replace function public.analytics_corpus_queries(p_fcid text, p_range text, p_limit int default 10, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$ select analytics.corpus_queries(p_fcid, p_range, p_limit, p_offset); $$;

create or replace function public.analytics_pool_names(p_range text, p_pool int, p_limit int default 40, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$ select analytics.pool_names(p_range, p_pool, p_limit, p_offset); $$;

create or replace function public.analytics_unresolved(p_range text, p_limit int default 10, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$ select analytics.unresolved(p_range, p_limit, p_offset); $$;

create or replace function public.analytics_requests_page(p_range text, p_limit int default 12, p_offset int default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$ select analytics.requests_page(p_range, p_limit, p_offset); $$;

create or replace function public.analytics_trace_detail(p_request_id uuid, p_raw_limit int default 4000)
returns jsonb language sql stable set search_path = public, pg_temp as $$ select analytics.trace_detail(p_request_id, p_raw_limit); $$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'analytics\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
