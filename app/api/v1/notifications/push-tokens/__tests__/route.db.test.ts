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
      last_seen_at timestamptz NOT NULL DEFAULT now(), last_pushed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await sql.unsafe(`CREATE TABLE ${schema}.user_profiles (
      user_id uuid PRIMARY KEY, time_zone text,
      preferred_locale text DEFAULT 'en')`);
    state.db = drizzle(sql);
  });
  beforeEach(async () => {
    await sql`TRUNCATE push_tokens, user_profiles`;
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

  it("writes the phone's language and zone onto the profile only when they changed", async () => {
    await sql`INSERT INTO user_profiles (user_id, time_zone, preferred_locale)
      VALUES (${USER}, 'Asia/Ho_Chi_Minh', 'en')`;
    const post = (body: object) =>
      POST(
        new Request('http://localhost/api/v1/notifications/push-tokens', {
          method: 'POST',
          body: JSON.stringify({ token: token(1), platform: 'ios', ...body }),
        }) as never
      );
    const profile = async () =>
      (
        await sql`SELECT time_zone, preferred_locale, xmin::text AS version
          FROM user_profiles WHERE user_id = ${USER}`
      )[0];

    // Same zone, new language: the language still lands.
    expect(
      (await post({ timeZone: 'Asia/Ho_Chi_Minh', locale: 'vi' })).status
    ).toBe(200);
    const written = await profile();
    expect(written).toMatchObject({
      time_zone: 'Asia/Ho_Chi_Minh',
      preferred_locale: 'vi',
    });
    // The same check-in again writes nothing: the row version stays put.
    await post({ timeZone: 'Asia/Ho_Chi_Minh', locale: 'vi' });
    expect((await profile()).version).toBe(written.version);
    // A language without a zone lands on its own.
    expect((await post({ locale: 'en' })).status).toBe(200);
    expect(await profile()).toMatchObject({
      time_zone: 'Asia/Ho_Chi_Minh',
      preferred_locale: 'en',
    });
    // No language sent (nothing picked on the phone): the stored one stays.
    expect((await post({ timeZone: 'Europe/Paris' })).status).toBe(200);
    expect(await profile()).toMatchObject({
      time_zone: 'Europe/Paris',
      preferred_locale: 'en',
    });
  });

  it('does not prune a token concurrently reassigned to another account', async () => {
    for (let n = 1; n <= 10; n++) {
      await sql`INSERT INTO push_tokens (user_id, token, platform, last_seen_at)
        VALUES (${USER}, ${token(n)}, 'ios', ${new Date(2020, 0, n).toISOString()})`;
    }
    let release!: () => void;
    let ready!: (pid: number) => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<number>((resolve) => {
      ready = resolve;
    });
    const transfer = sql.begin(async (tx) => {
      await tx`UPDATE push_tokens SET user_id = ${OTHER}, last_seen_at = now()
        WHERE token = ${token(1)}`;
      const [row] = await tx`SELECT pg_backend_pid() AS pid`;
      ready(row.pid);
      await hold;
    });
    const pid = await started;
    const registration = register(11);
    try {
      // Wait until the real DELETE has selected the old row and is waiting
      // for the other account's ownership update to commit.
      let blocked = false;
      for (let n = 0; n < 300; n++) {
        const waiting = await sql`SELECT pid FROM pg_stat_activity
          WHERE ${pid} = ANY(pg_blocking_pids(pid))
          AND query LIKE 'delete from "push_tokens"%'`;
        if (waiting.length) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
    } finally {
      release();
      await transfer;
      await registration;
    }
    expect(
      await sql`SELECT id FROM push_tokens
      WHERE user_id = ${OTHER} AND token = ${token(1)}`
    ).toHaveLength(1);
    expect(
      await sql`SELECT id FROM push_tokens WHERE user_id = ${USER}`
    ).toHaveLength(10);
  });
});
