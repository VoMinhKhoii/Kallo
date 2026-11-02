import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const { state } = vi.hoisted(() => ({ state: { db: undefined as unknown } }));
vi.mock('@/lib/infra/db/client', () => ({
  get db() {
    return state.db;
  },
}));
const USER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
vi.mock('@/lib/api/auth', () => ({
  requireUserId: async () => 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  readJsonBody: async (request: Request) => request.json(),
}));

import { POST } from '@/app/api/v1/notifications/push-tokens/route';

// Opt-in, isolated LOCAL Postgres only; never use the application's database URL.
const url = process.env.KALLO_PUSH_TEST_DB_URL;
describe.skipIf(!url)('push token retention in Postgres', () => {
  const schema = `push_test_${randomUUID().replaceAll('-', '')}`;
  let sql: ReturnType<typeof postgres>;
  beforeAll(async () => {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url!).hostname)) {
      throw new Error('Push token tests require local Postgres');
    }
    sql = postgres(url!, { max: 4, connection: { search_path: schema } });
    await sql.unsafe(`CREATE SCHEMA ${schema}`);
    await sql.unsafe(`CREATE TABLE ${schema}.push_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
      token text NOT NULL UNIQUE, platform text NOT NULL,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now())`);
    state.db = drizzle(sql);
  });
  beforeEach(async () => {
    await sql`TRUNCATE push_tokens`;
  });
  afterAll(async () => {
    if (sql) {
      await sql.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await sql.end();
    }
  });
  const token = (n: number) => n.toString(16).padStart(64, '0');
  async function register(n: number) {
    const request = new Request(
      'http://localhost/api/v1/notifications/push-tokens',
      {
        method: 'POST',
        body: JSON.stringify({ token: token(n), platform: 'ios' }),
      }
    );
    const response = await POST(request as never);
    expect(response.status).toBe(200);
  }

  it('keeps the newest ten registrations and leaves another user untouched', async () => {
    for (let n = 1; n <= 12; n++) {
      await sql`INSERT INTO push_tokens (user_id, token, platform, last_seen_at)
        VALUES (${USER}, ${token(n)}, 'ios', ${new Date(2020, 0, n).toISOString()})`;
    }
    await sql`INSERT INTO push_tokens (user_id, token, platform)
      VALUES (${OTHER}, ${token(99)}, 'ios')`;
    await register(13);
    const rows =
      await sql`SELECT token FROM push_tokens WHERE user_id = ${USER} ORDER BY token`;
    expect(rows.map((r) => r.token)).toEqual(
      Array.from({ length: 10 }, (_, i) => token(i + 4))
    );
    expect(
      await sql`SELECT id FROM push_tokens WHERE user_id = ${OTHER}`
    ).toHaveLength(1);
  });

  it('retains a refreshed device and serializes simultaneous registrations', async () => {
    await Promise.all(Array.from({ length: 16 }, (_, i) => register(i + 1)));
    expect(
      await sql`SELECT id FROM push_tokens WHERE user_id = ${USER}`
    ).toHaveLength(10);
    await register(1);
    expect(
      await sql`SELECT id FROM push_tokens WHERE user_id = ${USER}`
    ).toHaveLength(10);
    expect(
      await sql`SELECT id FROM push_tokens WHERE user_id = ${USER} AND token = ${token(1)}`
    ).toHaveLength(1);
  });
});
