import { instrumentPostgresJsSql } from '@sentry/core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { drizzle, type PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * URL-encode the password portion of a PostgreSQL connection
 * string to handle special characters (?, #, etc.) that break
 * URL parsing.
 */
export function encodeDbUrl(raw: string): string {
  const protoEnd = raw.indexOf('://') + 3;
  const userEnd = raw.indexOf(':', protoEnd);
  const atHost = raw.indexOf('@', userEnd);
  if (userEnd === -1 || atHost === -1) return raw;
  const password = raw.slice(userEnd + 1, atHost);
  return (
    raw.slice(0, userEnd + 1) + encodeURIComponent(password) + raw.slice(atHost)
  );
}

/** Seconds to establish a new connection, unless DB_CONNECT_TIMEOUT_S says otherwise. */
export const DB_CONNECT_TIMEOUT_DEFAULT_S = 10;

// Lazy-initialise the DB client so the module can be imported at
// build time even when DATABASE_URL is not set (e.g. CI builds,
// static page generation).
//
// One pool per process, kept on globalThis rather than in module variables.
// Next bundles instrumentation.ts, the proxy and the route handlers apart, so
// each gets its own copy of this module; with module variables each copy built
// its own pool, the boot warm-up below filled one no route used, and the first
// requests on a new instance waited on fresh connections (~105 ms each through
// the transaction pooler).
interface DbState {
  client?: ReturnType<typeof postgres>;
  db?: ReturnType<typeof drizzle<typeof schema>>;
}
const DB_STATE_KEY = Symbol.for('kallo.db');
function dbState(): DbState {
  const store = globalThis as typeof globalThis & { [DB_STATE_KEY]?: DbState };
  store[DB_STATE_KEY] ??= {};
  return store[DB_STATE_KEY];
}

function poolSize(): number {
  return Number(process.env.DB_POOL_MAX) || 2;
}

function getClient() {
  const state = dbState();
  if (!state.client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL is not set — cannot connect to the database.'
      );
    }
    // Wrapped so each query is a Sentry span inside the traced request. The
    // automatic postgres.js hook never applied here (no db spans in prod
    // traces even with `postgres` external), so slow API requests showed one
    // opaque span and DB wait could not be told apart from CPU.
    state.client = instrumentPostgresJsSql(
      postgres(encodeDbUrl(url), {
        // Small by default: on Supabase's session-mode pooler (5432) every pool
        // connection pins one of the database's few real ones. Prod connects
        // through transaction mode (6543), where connections are shared, and
        // raises it with DB_POOL_MAX (cloud-run-prod.yml). A too-small pool lets
        // one request's concurrent writes starve its own critical-path insert
        // (see the analyze-meal SSE hang).
        max: poolSize(),
        // Bound establishing a *new* connection so a dead pooler fails fast
        // instead of hanging the acquiring query indefinitely.
        connect_timeout:
          Number(process.env.DB_CONNECT_TIMEOUT_S) ||
          DB_CONNECT_TIMEOUT_DEFAULT_S,
        // Prepared statements are unsupported in PgBouncer transaction mode.
        prepare: false,
      })
    );
  }
  return state.client;
}

/**
 * Opens every pool connection at server boot (instrumentation.ts), so the
 * first burst of requests on a new instance does not pay for connection setup.
 * postgres.js opens connections lazily and keeps them (no idle timeout), so
 * running `pool size` queries at once leaves them all open. Never throws: a
 * failed warm-up only means the first requests connect as they always did.
 */
export async function warmDbPool(): Promise<void> {
  try {
    const client = getClient();
    await Promise.all(
      Array.from({ length: poolSize() }, () => client`select 1`)
    );
  } catch (error) {
    console.warn('[db] pool warm-up failed', error);
  }
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    const state = dbState();
    state.db ??= drizzle(getClient(), { schema });
    return Reflect.get(state.db, prop);
  },
});

/** Convenience type for the app's Drizzle database instance. */
export type AppDb = typeof db;

/**
 * The `tx` handle a `db.transaction(async (tx) => ...)` callback receives.
 * Lets a service function typed to accept `AppDb` also accept a transaction
 * from a caller's own `db.transaction`, so two writes (e.g. two service
 * functions from different modules) can share one atomic transaction instead
 * of each opening its own.
 */
export type AppTransaction = PostgresJsTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
