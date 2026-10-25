import { Errors } from '@/lib/core/errors/catalog';
import { db as appDb } from '@/lib/infra/db/client';
import { withDeadline } from '../sql-consumer';

/**
 * A reservation is on the path of every AI request and waits on a pool that
 * the request's own matching queries also use. 400 ms (the counter default)
 * would turn ordinary pool contention into refused meals; an analysis runs
 * for tens of seconds, so two seconds of waiting costs nothing visible.
 */
const LEASE_DB_TIMEOUT_MS = 2000;

/** The 11-arg consume, every argument cast (`prepare: false` — see sql-consumer). */
const CONSUME_SQL = `
  select allowed, reason, retry_after_seconds, spend_day::text as spend_day
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

/** The spend lease holds no slot, so it never sends a slot expiry. */
const RELEASE_SQL = `
  select public.rate_limit_release(
    $1::text,
    $2::text,
    $3::text,
    $4::date,
    $5::bigint,
    null::timestamptz,
    $6::timestamptz
  )
`;

export interface LeaseConsumeRow {
  allowed: boolean;
  reason: string | null;
  retry_after_seconds: number | null;
  /** `YYYY-MM-DD`, the UTC day the reservation was booked on. */
  spend_day: string | null;
}

export interface SpendReserveInput {
  route: string;
  spendMicroUsd: number;
  spendLimitMicroUsd: number;
  now?: Date;
}

export interface SpendSettleInput {
  route: string;
  spendDay: string;
  deltaMicroUsd: number;
  now?: Date;
}

/** The seam between `lease.ts` and Postgres; tests stand in a fake. */
export interface LeaseStore {
  reserve(input: SpendReserveInput): Promise<LeaseConsumeRow>;
  settle(input: SpendSettleInput): Promise<void>;
}

type LeaseDb = Pick<typeof appDb, '$client'>;

export function createSqlLeaseStore(database: LeaseDb = appDb): LeaseStore {
  return {
    async reserve(input) {
      const rows = await withDeadline(
        database.$client.unsafe<LeaseConsumeRow[]>(CONSUME_SQL, [
          'global',
          null,
          input.route,
          null,
          null,
          null,
          null,
          null,
          input.spendMicroUsd,
          input.spendLimitMicroUsd,
          input.now?.toISOString() ?? null,
        ]),
        LEASE_DB_TIMEOUT_MS
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
    async settle(input) {
      await withDeadline(
        database.$client.unsafe(RELEASE_SQL, [
          'global',
          null,
          input.route,
          input.spendDay,
          input.deltaMicroUsd,
          input.now?.toISOString() ?? null,
        ]),
        LEASE_DB_TIMEOUT_MS
      );
    },
  };
}
