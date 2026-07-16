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

// Lazy-initialise the DB client so the module can be imported at
// build time even when DATABASE_URL is not set (e.g. CI builds,
// static page generation).
let _client: ReturnType<typeof postgres> | undefined;
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

function getClient() {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL is not set — cannot connect to the database.'
      );
    }
    _client = postgres(encodeDbUrl(url), {
      // Shared staging can have internal + preview services alive at once.
      // Keep the per-instance session pool small so a second service doesn't
      // exhaust Supabase's session-mode pooler during cold starts or health checks.
      max: 2,
      // Prepared statements are unsupported in PgBouncer transaction mode.
      prepare: false,
    });
  }
  return _client;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    if (!_db) {
      _db = drizzle(getClient(), { schema });
    }
    return Reflect.get(_db, prop);
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
