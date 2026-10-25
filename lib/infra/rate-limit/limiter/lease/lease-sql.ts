import { Errors } from '@/lib/core/errors/catalog';
import { db as appDb } from '@/lib/infra/db/client';
import { withDeadline } from '../sql-consumer';
import type { RateLimitKeyKind, RateLimitLimits } from '../types';

/** The 11-arg consume, every argument cast (`prepare: false` — see sql-consumer). */
const CONSUME_SQL = `
  select
    allowed,
    reason,
    retry_after_seconds,
    spend_day::text as spend_day,
    slot_expires_at::text as slot_expires_at
  from public.rate_limit_consume(
    $1::text,
    $2::text,
    $3::text,
    $4::integer,
    $5::integer,
    $6::integer,
    $7::integer,
    $8::integer,
    $9::bigint,
    $10::bigint,
    $11::timestamptz
  )
`;

const RELEASE_SQL = `
  select public.rate_limit_release(
    $1::text,
    $2::text,
    $3::text,
    $4::date,
    $5::bigint,
    $6::timestamptz,
    $7::timestamptz
  )
`;

export interface LeaseConsumeRow {
  allowed: boolean;
  reason: string | null;
  retry_after_seconds: number | null;
  /** `YYYY-MM-DD`, the UTC day the reservation was booked on. */
  spend_day: string | null;
  /**
   * When the slot this call took expires; handed back on release so only
   * this holder, before then, frees it. Text, round-tripped as is.
   */
  slot_expires_at: string | null;
}

/**
 * One 11-arg consume: a key's windows and slot and/or a spend reservation.
 * `keyHash: null` checks spend only; `spendMicroUsd: null` checks the key
 * only. `limits: null` takes the slot without counting any window.
 */
export interface LeaseConsumeInput {
  keyKind: RateLimitKeyKind;
  keyHash: string | null;
  route: string;
  limits: RateLimitLimits | null;
  slot: { limit: number; ttlSeconds: number } | null;
  spendMicroUsd: number | null;
  spendLimitMicroUsd: number | null;
  now?: Date;
  /** Deadline for the round trip. */
  timeoutMs: number;
}

/**
 * One release: frees the key's slot when `keyHash` and `slotExpiresAt` are
 * set (and that slot has not expired), and adds `deltaMicroUsd` (signed) to
 * `spendDay`'s spend when both are set.
 */
export interface LeaseReleaseInput {
  keyKind: RateLimitKeyKind;
  keyHash: string | null;
  /** The `slot_expires_at` the consume returned to this holder. */
  slotExpiresAt: string | null;
  route: string;
  spendDay: string | null;
  deltaMicroUsd: number | null;
  now?: Date;
  timeoutMs: number;
}

/** The seam between `lease.ts` and Postgres; tests stand in a fake. */
export interface LeaseStore {
  consume(input: LeaseConsumeInput): Promise<LeaseConsumeRow>;
  release(input: LeaseReleaseInput): Promise<void>;
}

type LeaseDb = Pick<typeof appDb, '$client'>;

export function createSqlLeaseStore(database: LeaseDb = appDb): LeaseStore {
  return {
    async consume(input) {
      const rows = await withDeadline(
        database.$client.unsafe<LeaseConsumeRow[]>(CONSUME_SQL, [
          input.keyKind,
          input.keyHash,
          input.route,
          input.limits?.perMinute ?? null,
          input.limits?.perHour ?? null,
          input.limits?.perDay ?? null,
          input.slot?.limit ?? null,
          input.slot?.ttlSeconds ?? null,
          input.spendMicroUsd,
          input.spendLimitMicroUsd,
          input.now?.toISOString() ?? null,
        ]),
        input.timeoutMs
      );
      const row = rows[0];
      if (!row) {
        throw Errors.rateLimiterUnavailable(
          new Error('rate_limit_consume returned no rows'),
          'error'
        );
      }
      return row;
    },
    async release(input) {
      await withDeadline(
        database.$client.unsafe(RELEASE_SQL, [
          input.keyKind,
          input.keyHash,
          input.route,
          input.spendDay,
          input.deltaMicroUsd,
          input.slotExpiresAt,
          input.now?.toISOString() ?? null,
        ]),
        input.timeoutMs
      );
    },
  };
}
