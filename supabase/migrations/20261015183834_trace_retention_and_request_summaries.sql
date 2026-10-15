-- Domain B: bounded telemetry retention and the existing operator-list RPC.
-- Domain A's preceding migration supplies missing created_at-leading indexes.
-- Budget events already have analysis_model_budget_events_created_idx;
-- pipeline_runs already has idx_pipeline_runs_created_at (20260430201542).
SET search_path TO public, extensions;

DROP INDEX IF EXISTS public.pipeline_requests_user_id_created_at_idx;
-- Keep pipeline_requests_user_created_idx: same owner/time lookup.

-- Follow the current fail-loud retention migrations: never silently commit
-- an unscheduled privacy/retention policy. Requires the migration role's cron grant.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $migration$
DECLARE
  policy record;
  fn text;
BEGIN
  FOR policy IN SELECT * FROM (VALUES
    ('analysis_model_budget_events', 181, '01 4 * * *'),
    ('pipeline_runs', 181, '04 4 * * *'),
    ('analysis_guard_events', 30, '07 4 * * *'),
    ('unmatched_ingredients', 90, '10 4 * * *'),
    ('synonym_candidates', 90, '13 4 * * *'),
    ('pipeline_request_replay_audit_logs', 181, '16 4 * * *')
  ) AS p(table_name, days, schedule)
  LOOP
    fn := 'reap_' || policy.table_name;
    EXECUTE format($ddl$
      CREATE OR REPLACE FUNCTION public.%I()
      RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = pg_catalog, pg_temp
      AS $body$
      DECLARE
        affected integer;
        total integer := 0;
        cutoff timestamptz := now() - %L::interval;
      BEGIN
        -- At most 100k rows/run, 5k per statement. Locks remain until commit;
        -- a large initial backlog may need repeated manual invocations.
        FOR batch IN 1..20 LOOP
          DELETE FROM public.%I WHERE ctid IN (
            SELECT ctid FROM public.%I
            WHERE created_at < cutoff ORDER BY created_at LIMIT 5000
            FOR UPDATE SKIP LOCKED
          );
          GET DIAGNOSTICS affected = ROW_COUNT;
          total := total + affected;
          EXIT WHEN affected < 5000;
        END LOOP;
        RETURN total;
      END;
      $body$;
    $ddl$, fn, policy.days || ' days', policy.table_name, policy.table_name);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I() TO service_role', fn);
    IF EXISTS (SELECT 1 FROM cron.job c WHERE c.jobname = 'reap-' || policy.table_name || '-daily') THEN
      PERFORM cron.unschedule('reap-' || policy.table_name || '-daily');
    END IF;
    PERFORM cron.schedule('reap-' || policy.table_name || '-daily', policy.schedule,
      format('SELECT public.%I();', fn));
    IF NOT EXISTS (SELECT 1 FROM cron.job c
      WHERE c.jobname = 'reap-' || policy.table_name || '-daily' AND c.active) THEN
      RAISE EXCEPTION 'Retention job for % was not scheduled', policy.table_name;
    END IF;
  END LOOP;
END $migration$;

-- Preserve the positional rows used by the existing analytics UI. Add a
-- summary map keyed by request UUID so readers can adopt the expand columns.
CREATE OR REPLACE FUNCTION public.analytics_requests_page(
  p_range text, p_limit int DEFAULT 12, p_offset int DEFAULT 0
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH base AS (
    SELECT analytics.requests_page(p_range, p_limit, p_offset) payload
  ), requests AS (
    SELECT row.ordinality, row.value, request.*
    FROM base,
      LATERAL jsonb_array_elements(base.payload->'rows') WITH ORDINALITY row(value, ordinality)
    LEFT JOIN public.pipeline_requests request ON request.id = (row.value->>9)::uuid
  )
  SELECT jsonb_set(base.payload, '{rows}', coalesce((
    SELECT jsonb_agg(jsonb_set(value, '{3}',
      to_jsonb(coalesce(left(raw_input, 240), value->>3, '—')), true) ORDER BY ordinality)
    FROM requests
  ), '[]'::jsonb), true) || jsonb_build_object('summaries', coalesce((
    SELECT jsonb_object_agg(id::text, jsonb_build_object(
      'mealName', meal_name, 'modelProfile', model_profile, 'models', models,
      'caloriesKcal', calories_kcal, 'proteinG', protein_g,
      'carbohydrateG', carbohydrate_g, 'fatG', fat_g,
      'itemCount', item_count, 'errorCode', error_code, 'traceLogged', trace_logged
    )) FROM requests WHERE id IS NOT NULL
  ), '{}'::jsonb)) FROM base;
$$;
REVOKE ALL ON FUNCTION public.analytics_requests_page(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_requests_page(text, int, int) TO analytics_reader, service_role;
