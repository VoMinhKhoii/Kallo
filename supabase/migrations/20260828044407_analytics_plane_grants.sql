
-- The public wrappers ran as the CALLER, which has no USAGE on the analytics
-- schema, so every call failed with "permission denied for schema analytics".
-- Making them SECURITY DEFINER means a caller needs EXECUTE on the wrapper and
-- nothing else: the analytics schema itself stays unreachable to every client
-- role. search_path is pinned on each function, which is what makes that safe.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'analytics\_%'
  loop
    execute format('alter function %s security definer', f.sig);
    execute format('revoke all on function %s from public', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- A restricted reader role for the dashboard: it may execute the eleven
-- wrappers and touch nothing else. Created only if it does not already exist so
-- this migration is safe to re-run.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'analytics_reader') then
    create role analytics_reader nologin;
  end if;
end $$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'analytics\_%'
  loop
    execute format('grant execute on function %s to analytics_reader', f.sig);
  end loop;
end $$;

grant usage on schema public to analytics_reader;

-- PostgREST authenticates as `authenticator` and then SETs ROLE, so it must be
-- able to become the reader.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'grant analytics_reader to authenticator';
  end if;
end $$;

-- Belt and braces: the analytics schema stays closed to the public roles.
revoke all on schema analytics from anon, authenticated, public;
revoke all on all functions in schema analytics from anon, authenticated, public;
revoke all on all tables in schema analytics from anon, authenticated, public;
