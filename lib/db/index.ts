import { drizzle } from 'drizzle-orm/postgres-js';
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

const connectionString = encodeDbUrl(process.env.DATABASE_URL!);
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
