-- =============================================================================
-- Domain B: Database Security & Logic — public.rate_limit_consume()
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- One round trip per (key, route): a single INSERT … ON CONFLICT DO UPDATE
-- that rolls all three windows forward, increments them, and commits the
-- increment ONLY if every enforced window still has headroom. Postgres locks
-- the conflicting row before evaluating the DO UPDATE ... WHERE, so concurrent
-- consumes serialize on that lock and a blocked request never leaves a counter
-- raised — the block path re-reads the (already locked) row to build the
-- reason and Retry-After.
--
-- Non-negotiable mechanics:
--
--  * THREE-ARGUMENT date_trunc(field, source, timezone). The two-argument form
--    truncates in the SESSION TimeZone, and under a transaction pooler the
--    session that runs this statement is not one we own — the same user would
--    land in different day buckets depending on which backend answered.
--
--  * A limit that is NULL or <= 0 means NOT ENFORCED. An unenforced window is
--    never incremented, so its counter cannot climb toward int overflow on a
--    route that only bounds, say, the day; and an enforced window can never
--    exceed its limit, because the statement that would push it over is the
--    statement whose WHERE fails.
--
--  * Every column reference is qualified through the `t` alias and every
--    object is schema-qualified, so `supabase db lint`'s plpgsql checks pass
--    and `search_path = pg_catalog, pg_temp` cannot be exploited.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rate_limit_consume(
  p_key_kind text,
  p_key_hash text,
  p_route text,
  p_minute_limit int,
  p_hour_limit int,
  p_day_limit int,
  p_now timestamptz DEFAULT NULL
)
RETURNS TABLE (
  allowed boolean,
  reason text,
  retry_after_seconds int,
  remaining_minute int,
  remaining_hour int,
  remaining_day int
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_now timestamptz;
  v_minute_start timestamptz;
  v_hour_start timestamptz;
  v_day_start timestamptz;
  v_minute_limit int;
  v_hour_limit int;
  v_day_limit int;
  v_minute_count int;
  v_hour_count int;
  v_day_count int;
  v_row_minute_start timestamptz;
  v_row_hour_start timestamptz;
  v_row_day_start timestamptz;
  v_window_end timestamptz;
  v_reason text;
  v_retry_after int;
BEGIN
  v_now := coalesce(p_now, now());

  -- UTC-pinned window starts. Never the 2-arg date_trunc (see header).
  v_minute_start := date_trunc('minute', v_now, 'UTC');
  v_hour_start := date_trunc('hour', v_now, 'UTC');
  v_day_start := date_trunc('day', v_now, 'UTC');

  -- NULL or non-positive => window not enforced.
  v_minute_limit := CASE
    WHEN p_minute_limit IS NULL OR p_minute_limit <= 0 THEN NULL
    ELSE p_minute_limit
  END;
  v_hour_limit := CASE
    WHEN p_hour_limit IS NULL OR p_hour_limit <= 0 THEN NULL
    ELSE p_hour_limit
  END;
  v_day_limit := CASE
    WHEN p_day_limit IS NULL OR p_day_limit <= 0 THEN NULL
    ELSE p_day_limit
  END;

  INSERT INTO public.rate_limit_counters AS t (
    key_kind,
    key_hash,
    route,
    minute_start,
    minute_count,
    hour_start,
    hour_count,
    day_start,
    day_count,
    updated_at
  )
  VALUES (
    p_key_kind,
    p_key_hash,
    p_route,
    v_minute_start,
    CASE WHEN v_minute_limit IS NULL THEN 0 ELSE 1 END,
    v_hour_start,
    CASE WHEN v_hour_limit IS NULL THEN 0 ELSE 1 END,
    v_day_start,
    CASE WHEN v_day_limit IS NULL THEN 0 ELSE 1 END,
    v_now
  )
  ON CONFLICT ON CONSTRAINT rate_limit_counters_pkey DO UPDATE
  SET
    -- greatest(): windows roll FORWARD only, so a backwards-skewed p_now from
    -- one instance can never hand a caller a fresh bucket.
    minute_start = greatest(t.minute_start, v_minute_start),
    hour_start = greatest(t.hour_start, v_hour_start),
    day_start = greatest(t.day_start, v_day_start),
    minute_count = CASE
      WHEN v_minute_limit IS NULL
        THEN CASE WHEN t.minute_start < v_minute_start THEN 0
                  ELSE t.minute_count END
      WHEN t.minute_start < v_minute_start THEN 1
      ELSE t.minute_count + 1
    END,
    hour_count = CASE
      WHEN v_hour_limit IS NULL
        THEN CASE WHEN t.hour_start < v_hour_start THEN 0
                  ELSE t.hour_count END
      WHEN t.hour_start < v_hour_start THEN 1
      ELSE t.hour_count + 1
    END,
    day_count = CASE
      WHEN v_day_limit IS NULL
        THEN CASE WHEN t.day_start < v_day_start THEN 0
                  ELSE t.day_count END
      WHEN t.day_start < v_day_start THEN 1
      ELSE t.day_count + 1
    END,
    updated_at = v_now
  WHERE
    (
      v_minute_limit IS NULL
      OR CASE WHEN t.minute_start < v_minute_start THEN 0
              ELSE t.minute_count END < v_minute_limit
    )
    AND (
      v_hour_limit IS NULL
      OR CASE WHEN t.hour_start < v_hour_start THEN 0
              ELSE t.hour_count END < v_hour_limit
    )
    AND (
      v_day_limit IS NULL
      OR CASE WHEN t.day_start < v_day_start THEN 0
              ELSE t.day_count END < v_day_limit
    )
  RETURNING t.minute_count, t.hour_count, t.day_count
  INTO v_minute_count, v_hour_count, v_day_count;

  IF FOUND THEN
    RETURN QUERY SELECT
      true,
      NULL::text,
      NULL::int,
      CASE WHEN v_minute_limit IS NULL THEN NULL
           ELSE v_minute_limit - v_minute_count END,
      CASE WHEN v_hour_limit IS NULL THEN NULL
           ELSE v_hour_limit - v_hour_count END,
      CASE WHEN v_day_limit IS NULL THEN NULL
           ELSE v_day_limit - v_day_count END;
    RETURN;
  END IF;

  -- Blocked: the upsert took the row lock, failed its headroom test and wrote
  -- nothing. Re-read the row we already hold to report WHICH window is out.
  SELECT
    t.minute_start,
    t.minute_count,
    t.hour_start,
    t.hour_count,
    t.day_start,
    t.day_count
  INTO
    v_row_minute_start,
    v_minute_count,
    v_row_hour_start,
    v_hour_count,
    v_row_day_start,
    v_day_count
  FROM public.rate_limit_counters t
  WHERE t.key_kind = p_key_kind
    AND t.key_hash = p_key_hash
    AND t.route = p_route;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'rate_limit_consume: no counter row for (%, %, %) after a blocked upsert',
      p_key_kind, p_key_hash, p_route;
  END IF;

  -- Same rollover the upsert would have applied, so the reported window is the
  -- one the WHERE actually rejected.
  v_minute_count := CASE WHEN v_row_minute_start < v_minute_start THEN 0
                         ELSE v_minute_count END;
  v_hour_count := CASE WHEN v_row_hour_start < v_hour_start THEN 0
                       ELSE v_hour_count END;
  v_day_count := CASE WHEN v_row_day_start < v_day_start THEN 0
                      ELSE v_day_count END;

  -- Two different questions, two different answers:
  --
  --  * `reason` is the SMALLEST exhausted window. It is the diagnosis — the
  --    tightest ceiling this caller hit — and it is what telemetry groups on.
  --
  --  * `retry_after_seconds` is the LATEST end among ALL exhausted windows.
  --    Reporting the smallest window's end here (the original bug) tells a
  --    client that exhausted both its minute and its hour at 10:00:30 to come
  --    back in 30 seconds, at which point the hour window refuses it again —
  --    a well-behaved client that honours Retry-After is turned into a
  --    once-a-minute polling loop for the rest of the hour. The reported
  --    instant must be one where a retry can actually succeed.
  --
  -- greatest() ignores NULLs, so each arm can fold into v_window_end blind.
  v_reason := NULL;
  v_window_end := NULL;

  IF v_minute_limit IS NOT NULL AND v_minute_count >= v_minute_limit THEN
    v_reason := 'minute';
    v_window_end := greatest(
      v_window_end,
      greatest(v_row_minute_start, v_minute_start) + interval '1 minute'
    );
  END IF;

  IF v_hour_limit IS NOT NULL AND v_hour_count >= v_hour_limit THEN
    v_reason := coalesce(v_reason, 'hour');
    v_window_end := greatest(
      v_window_end,
      greatest(v_row_hour_start, v_hour_start) + interval '1 hour'
    );
  END IF;

  IF v_day_limit IS NOT NULL AND v_day_count >= v_day_limit THEN
    v_reason := coalesce(v_reason, 'day');
    -- '24 hours', not '1 day': adding a day-typed interval to a timestamptz is
    -- resolved in the SESSION TimeZone and lands an hour off across a DST
    -- transition. The bucket is a UTC calendar day, which is always exactly 24
    -- hours wide, so the exact interval is both simpler and pooler-proof.
    v_window_end := greatest(
      v_window_end,
      greatest(v_row_day_start, v_day_start) + interval '24 hours'
    );
  END IF;

  IF v_reason IS NULL THEN
    -- Invariant: the upsert only declines when a window is exhausted. Raising
    -- is correct — silently returning "allowed" would uncap the route, and
    -- silently returning a blank block would 429 with no reason forever.
    RAISE EXCEPTION
      'rate_limit_consume: upsert declined but no window is exhausted (%, %)',
      p_key_kind, p_route;
  END IF;

  v_retry_after := greatest(
    1,
    ceil(extract(epoch FROM (v_window_end - v_now)))::int
  );

  RETURN QUERY SELECT
    false,
    v_reason,
    v_retry_after,
    CASE WHEN v_minute_limit IS NULL THEN NULL
         ELSE greatest(0, v_minute_limit - v_minute_count) END,
    CASE WHEN v_hour_limit IS NULL THEN NULL
         ELSE greatest(0, v_hour_limit - v_hour_count) END,
    CASE WHEN v_day_limit IS NULL THEN NULL
         ELSE greatest(0, v_day_limit - v_day_count) END;
END;
$$;

-- Server-only. Both revokes are needed: the schema-scoped one strips Supabase's
-- explicit anon/authenticated defaults, the PUBLIC one overrides PostgreSQL's
-- built-in EXECUTE default that a role-scoped revoke cannot remove.
REVOKE ALL ON FUNCTION public.rate_limit_consume(
  text, text, text, int, int, int, timestamptz
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rate_limit_consume(
  text, text, text, int, int, int, timestamptz
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_consume(
  text, text, text, int, int, int, timestamptz
) TO service_role;
