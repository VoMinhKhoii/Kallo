/**
 * The builder's own read-only connection. It does not import
 * `lib/infra/db/client.ts`: that module pulls in the Drizzle schema, and every
 * file the builder imports is part of the artifact key (`spec.ts`), so a schema
 * edit would force a full rebuild.
 */
import postgres from 'postgres';

/**
 * Percent-encodes the password of a `postgresql://user:pass@host/db` URL —
 * the same rule as `encodeDbUrl` in `lib/infra/db/client.ts`, whose prod
 * passwords carry URL-special characters.
 */
export function encodePassword(raw: string): string {
  const protoEnd = raw.indexOf('://') + 3;
  const userEnd = raw.indexOf(':', protoEnd);
  const atHost = raw.indexOf('@', userEnd);
  if (userEnd === -1 || atHost === -1) return raw;
  const password = raw.slice(userEnd + 1, atHost);
  return (
    raw.slice(0, userEnd + 1) + encodeURIComponent(password) + raw.slice(atHost)
  );
}

export type ReadOnlySql = ReturnType<typeof postgres>;

/**
 * One connection that asks for read-only sessions. That startup setting is a
 * backstop only (Supabase's pooler may not forward it): the builder runs every
 * query inside an explicit READ ONLY transaction (`publish.ts`).
 */
export function connect(databaseUrl: string): ReadOnlySql {
  return postgres(encodePassword(databaseUrl), {
    max: 1,
    prepare: false,
    connection: { default_transaction_read_only: true },
  });
}
