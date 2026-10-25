-- =============================================================================
-- Domain B: Database Security & Logic — the limiter's one-call consume grows a
-- one-at-a-time slot and the app-wide AI spend brake.
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- public.rate_limit_consume(... 11 args) — ONE call per guarded request that,
-- atomically:
--   1. checks the day's AI spend in `ai_spend_days` (when the caller reserves
--      spend) and refuses with reason 'budget' if the reservation would cross
--      the limit;
--   2. runs the minute/hour/day windows exactly as the 7-arg version does,
--      plus an optional slot (reason 'concurrent' when every slot is held);
--   3. adds the reservation to the day's spend — only once 1 and 2 admitted.
-- A refused request writes nothing: the budget row is only LOCKED (FOR UPDATE)
-- before the counters run, and the counters' upsert writes nothing when its
-- headroom test fails. Everything runs inside the one statement's
-- transaction, so a reservation can never outlive a refusal.
--
-- public.rate_limit_release(...) — frees one slot and settles spend (the real
-- cost minus the estimate, or a late attempt's cost) in one call.
--
-- The 7-arg rate_limit_consume stays until the deployed code no longer calls
-- it; a later migration drops it (docs/DATABASE.md "Shared staging preview
-- rule": code stops using a thing, deploy, then drop).
--
-- Non-negotiable mechanics (same as 20260901194714):
--  * UTC everywhere: three-argument date_trunc, and the spend day is
--    (v_now AT TIME ZONE 'UTC')::date — never CURRENT_DATE, which is the
--    SESSION zone's date and the pooler's session is not ours.
--  * A window limit that is NULL or <= 0 is not enforced and never counted.
--  * Every column is qualified through an alias and every object is
--    schema-qualified, for `supabase db lint` and the empty search_path.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rate_limit_consume(
  p_key_kind text,
  p_key_hash text,
  p_route text,
  p_minute_limit int,
  p_hour_limit int,
  p_day_limit int,
  p_slot_limit int,
  p_slot_ttl_seconds int,
  p_spend_micro_usd bigint,
  p_spend_limit_micro_usd bigint,
  p_now timestamptz DEFAULT NULL
)
RETURNS TABLE (
  allowed boolean,
  reason text,
  retry_after_seconds int,
  remaining_minute int,
  remaining_hour int,
  remaining_day int,
  spend_day date
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_now timestamptz;
  v_day date;
  v_minute_start timestamptz;
  v_hour_start timestamptz;
  v_day_start timestamptz;
  v_minute_limit int;
  v_hour_limit int;
  v_day_limit int;
  v_slot_limit int;
  v_slot_ttl interval;
  v_spend bigint;
  v_spent bigint;
  v_minute_count int;
  v_hour_count int;
  v_day_count int;
  v_slot_count int;
  v_row_minute_start timestamptz;
  v_row_hour_start timestamptz;
  v_row_day_start timestamptz;
  v_row_slot_expires_at timestamptz;
  v_window_end timestamptz;
  v_reason text;
BEGIN
  v_now := coalesce(p_now, now());
  v_day := (v_now AT TIME ZONE 'UTC')::date;

  v_minute_start := date_trunc('minute', v_now, 'UTC');
  v_hour_start := date_trunc('hour', v_now, 'UTC');
  v_day_start := date_trunc('day', v_now, 'UTC');

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
  v_slot_limit := CASE
    WHEN p_slot_limit IS NULL OR p_slot_limit <= 0 THEN NULL
    ELSE p_slot_limit
  END;
  v_spend := CASE
    WHEN p_spend_micro_usd IS NULL OR p_spend_micro_usd < 0 THEN NULL
    ELSE p_spend_micro_usd
  END;

  -- A slot with no lifetime would be held forever by a request that crashed;
  -- a reservation with no limit has nothing to be checked against. Both are
  -- caller bugs, and admitting would hide them.
  IF v_slot_limit IS NOT NULL
     AND (p_slot_ttl_seconds IS NULL OR p_slot_ttl_seconds <= 0) THEN
    RAISE EXCEPTION 'rate_limit_consume: a slot needs a positive ttl (%)',
      p_route;
  END IF;
  IF v_spend IS NOT NULL AND p_spend_limit_micro_usd IS NULL THEN
    RAISE EXCEPTION 'rate_limit_consume: a spend reservation needs a limit (%)',
      p_route;
  END IF;
  IF p_key_hash IS NULL AND v_spend IS NULL THEN
    RAISE EXCEPTION 'rate_limit_consume: nothing to consume (%)', p_route;
  END IF;

  v_slot_ttl := make_interval(secs => coalesce(p_slot_ttl_seconds, 0));

  -- 1. The spend brake. Lock the day's row so concurrent reservations queue
  --    behind each other and the check below cannot be raced past the limit.
  IF v_spend IS NOT NULL THEN
    INSERT INTO public.ai_spend_days AS s (day, spent_micro_usd, updated_at)
    VALUES (v_day, 0, v_now)
    ON CONFLICT (day) DO NOTHING;

    SELECT s.spent_micro_usd
    INTO v_spent
    FROM public.ai_spend_days s
    WHERE s.day = v_day
    FOR UPDATE;

    IF v_spent >= p_spend_limit_micro_usd
       OR v_spent + v_spend > p_spend_limit_micro_usd THEN
      -- Stamped once: a flood of refusals must not become a flood of writes
      -- to a LOGGED row.
      UPDATE public.ai_spend_days s
      SET first_blocked_at = v_now, updated_at = v_now
      WHERE s.day = v_day AND s.first_blocked_at IS NULL;

      RETURN QUERY SELECT
        false,
        'budget'::text,
        greatest(
          1,
          ceil(extract(epoch FROM (
            ((v_day + 1)::timestamp AT TIME ZONE 'UTC') - v_now
          )))::int
        ),
        NULL::int,
        NULL::int,
        NULL::int,
        NULL::date;
      RETURN;
    END IF;
  END IF;

  -- 2. The key's windows and slot, in one upsert that writes nothing when any
  --    enforced window or the slot has no headroom.
  IF p_key_hash IS NOT NULL THEN
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
      slot_count,
      slot_expires_at,
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
      CASE WHEN v_slot_limit IS NULL THEN 0 ELSE 1 END,
      CASE WHEN v_slot_limit IS NULL THEN NULL ELSE v_now + v_slot_ttl END,
      v_now
    )
    ON CONFLICT ON CONSTRAINT rate_limit_counters_pkey DO UPDATE
    SET
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
      -- An expired slot reads as free: a request that crashed without
      -- releasing stops holding it once its lifetime runs out.
      slot_count = CASE
        WHEN v_slot_limit IS NULL THEN t.slot_count
        WHEN t.slot_expires_at IS NULL OR t.slot_expires_at <= v_now THEN 1
        ELSE t.slot_count + 1
      END,
      slot_expires_at = CASE
        WHEN v_slot_limit IS NULL THEN t.slot_expires_at
        ELSE v_now + v_slot_ttl
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
      AND (
        v_slot_limit IS NULL
        OR CASE WHEN t.slot_expires_at IS NULL OR t.slot_expires_at <= v_now
                THEN 0
                ELSE t.slot_count END < v_slot_limit
      )
    RETURNING t.minute_count, t.hour_count, t.day_count
    INTO v_minute_count, v_hour_count, v_day_count;

    IF NOT FOUND THEN
      SELECT
        t.minute_start,
        t.minute_count,
        t.hour_start,
        t.hour_count,
        t.day_start,
        t.day_count,
        t.slot_count,
        t.slot_expires_at
      INTO
        v_row_minute_start,
        v_minute_count,
        v_row_hour_start,
        v_hour_count,
        v_row_day_start,
        v_day_count,
        v_slot_count,
        v_row_slot_expires_at
      FROM public.rate_limit_counters t
      WHERE t.key_kind = p_key_kind
        AND t.key_hash = p_key_hash
        AND t.route = p_route;

      IF NOT FOUND THEN
        RAISE EXCEPTION
          'rate_limit_consume: no counter row for (%, %, %) after a blocked upsert',
          p_key_kind, p_key_hash, p_route;
      END IF;

      v_minute_count := CASE WHEN v_row_minute_start < v_minute_start THEN 0
                             ELSE v_minute_count END;
      v_hour_count := CASE WHEN v_row_hour_start < v_hour_start THEN 0
                           ELSE v_hour_count END;
      v_day_count := CASE WHEN v_row_day_start < v_day_start THEN 0
                          ELSE v_day_count END;
      v_slot_count := CASE
        WHEN v_row_slot_expires_at IS NULL OR v_row_slot_expires_at <= v_now
          THEN 0
        ELSE v_slot_count
      END;

      -- `reason` is the smallest exhausted window (a window outranks the
      -- slot: waiting for the slot is pointless while a window is out);
      -- Retry-After is the LATEST end among everything exhausted, so a
      -- client that honours it does not come back to another refusal.
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
        v_window_end := greatest(
          v_window_end,
          greatest(v_row_day_start, v_day_start) + interval '24 hours'
        );
      END IF;

      IF v_slot_limit IS NOT NULL AND v_slot_count >= v_slot_limit THEN
        v_reason := coalesce(v_reason, 'concurrent');
        v_window_end := greatest(v_window_end, v_row_slot_expires_at);
      END IF;

      IF v_reason IS NULL THEN
        RAISE EXCEPTION
          'rate_limit_consume: upsert declined but nothing is exhausted (%, %)',
          p_key_kind, p_route;
      END IF;

      RETURN QUERY SELECT
        false,
        v_reason,
        greatest(1, ceil(extract(epoch FROM (v_window_end - v_now)))::int),
        CASE WHEN v_minute_limit IS NULL THEN NULL
             ELSE greatest(0, v_minute_limit - v_minute_count) END,
        CASE WHEN v_hour_limit IS NULL THEN NULL
             ELSE greatest(0, v_hour_limit - v_hour_count) END,
        CASE WHEN v_day_limit IS NULL THEN NULL
             ELSE greatest(0, v_day_limit - v_day_count) END,
        NULL::date;
      RETURN;
    END IF;
  END IF;

  -- 3. Admitted: book the reservation on the row step 1 locked.
  IF v_spend IS NOT NULL AND v_spend > 0 THEN
    UPDATE public.ai_spend_days s
    SET spent_micro_usd = s.spent_micro_usd + v_spend, updated_at = v_now
    WHERE s.day = v_day;
  END IF;

  RETURN QUERY SELECT
    true,
    NULL::text,
    NULL::int,
    CASE WHEN v_minute_limit IS NULL THEN NULL
         ELSE v_minute_limit - v_minute_count END,
    CASE WHEN v_hour_limit IS NULL THEN NULL
         ELSE v_hour_limit - v_hour_count END,
    CASE WHEN v_day_limit IS NULL THEN NULL
         ELSE v_day_limit - v_day_count END,
    CASE WHEN v_spend IS NULL THEN NULL ELSE v_day END;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_consume(
  text, text, text, int, int, int, int, int, bigint, bigint, timestamptz
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rate_limit_consume(
  text, text, text, int, int, int, int, int, bigint, bigint, timestamptz
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_consume(
  text, text, text, int, int, int, int, int, bigint, bigint, timestamptz
) TO service_role;

-- Free one slot on a key and/or settle spend on the day it was reserved on.
-- `p_spend_delta_micro_usd` is signed: real cost minus the estimate (negative
-- when the call cost less), or a late attempt's whole cost with no
-- reservation behind it. The day is the one `rate_limit_consume` returned,
-- so a call that straddles UTC midnight settles where it reserved.
CREATE OR REPLACE FUNCTION public.rate_limit_release(
  p_key_kind text,
  p_key_hash text,
  p_route text,
  p_spend_day date,
  p_spend_delta_micro_usd bigint,
  p_now timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_now timestamptz;
BEGIN
  v_now := coalesce(p_now, now());

  IF p_key_hash IS NOT NULL THEN
    UPDATE public.rate_limit_counters t
    SET
      slot_count = CASE
        WHEN t.slot_expires_at IS NULL OR t.slot_expires_at <= v_now THEN 0
        ELSE t.slot_count - 1
      END,
      updated_at = v_now
    WHERE t.key_kind = p_key_kind
      AND t.key_hash = p_key_hash
      AND t.route = p_route
      AND t.slot_count > 0;
  END IF;

  IF p_spend_day IS NOT NULL
     AND p_spend_delta_micro_usd IS NOT NULL
     AND p_spend_delta_micro_usd <> 0 THEN
    INSERT INTO public.ai_spend_days AS s (day, spent_micro_usd, updated_at)
    VALUES (p_spend_day, greatest(p_spend_delta_micro_usd, 0), v_now)
    ON CONFLICT (day) DO UPDATE
    SET
      spent_micro_usd = greatest(s.spent_micro_usd + p_spend_delta_micro_usd, 0),
      updated_at = v_now;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_release(
  text, text, text, date, bigint, timestamptz
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rate_limit_release(
  text, text, text, date, bigint, timestamptz
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_release(
  text, text, text, date, bigint, timestamptz
) TO service_role;
