/** Real DB regression for released-handle reservations (the
 * public_profiles_reserve_handle trigger), run by CI's migrations job; skips
 * only without a URL. The service functions commit, so each case uses fresh
 * users, deleted afterwards with the reservations they leave.
 */
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import {
  getOrCreateMyProfile,
  getProfileBySlug,
  renameMyProfile,
  upsertPublicProfile,
} from '@/lib/actions/groups/profile';
import type { Db } from '@/lib/actions/groups/types';
import { encodeDbUrl } from '@/lib/infra/db/client';
import * as schema from '@/lib/infra/db/schema';

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl
  ? postgres(encodeDbUrl(databaseUrl), { max: 3, prepare: false })
  : null;
const db = (sql ? drizzle(sql, { schema }) : null) as Db;
const created: string[] = [];

function pg() {
  if (!sql) throw new Error('DATABASE_URL required');
  return sql;
}

afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM auth.users WHERE id = ANY(${created}::uuid[])`;
  await sql`DELETE FROM public.released_handles WHERE user_id = ANY(${created}::uuid[])`;
  await sql.end({ timeout: 5 });
});

async function newUser() {
  const id = randomUUID();
  await pg()`INSERT INTO auth.users (id) VALUES (${id})`;
  created.push(id);
  await getOrCreateMyProfile(id, null, db);
  return id;
}

/** A handle no earlier run can have reserved. */
function freshHandle() {
  return `qh${randomUUID().replaceAll('-', '').slice(0, 14)}`;
}

async function reservation(handle: string) {
  const rows = await pg()`
    SELECT user_id FROM public.released_handles WHERE handle = ${handle}
  `;
  return rows[0]?.user_id ?? null;
}

const HANDLE_TAKEN = {
  code: 'CONFLICT',
  status: 409,
  message: 'Handle này đã được sử dụng.',
};

describe.skipIf(!databaseUrl)('released handles stay with their owner', () => {
  it('refuses a slug edit to a handle another user gave up, and its link stays dead', async () => {
    const owner = await newUser();
    const other = await newUser();
    const old = freshHandle();
    await upsertPublicProfile(owner, { handle: old }, db);
    await upsertPublicProfile(owner, { handle: freshHandle() }, db);

    expect(await reservation(old)).toBe(owner);
    await expect(
      upsertPublicProfile(other, { handle: old, displayName: 'Copy' }, db)
    ).rejects.toMatchObject(HANDLE_TAKEN);
    expect(await getProfileBySlug(old, db)).toBeNull();
  });

  it('suffixes a rename whose derived handle another user gave up', async () => {
    const owner = await newUser();
    const other = await newUser();
    const name = `Qn ${randomUUID().slice(0, 8).replace(/\d/g, 'x')}`;
    const { handle: base } = await renameMyProfile(owner, name, db);
    await renameMyProfile(owner, `${name} Two`, db);

    const renamed = await renameMyProfile(other, name, db);

    expect(renamed.handle).not.toBe(base);
    expect(renamed.handle.startsWith(base)).toBe(true);
    expect(await reservation(base)).toBe(owner);
  });

  it('refuses a direct database write of a reserved handle (trigger)', async () => {
    const owner = await newUser();
    const other = await newUser();
    const old = freshHandle();
    await upsertPublicProfile(owner, { handle: old }, db);
    await upsertPublicProfile(owner, { handle: freshHandle() }, db);

    await expect(
      pg()`UPDATE public.public_profiles SET handle = ${old} WHERE user_id = ${other}`
    ).rejects.toMatchObject({ code: '23505' });
    const stranger = randomUUID();
    await pg()`INSERT INTO auth.users (id) VALUES (${stranger})`;
    created.push(stranger);
    await expect(
      pg()`INSERT INTO public.public_profiles (user_id, handle) VALUES (${stranger}, ${old})`
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('lets the owner reclaim their handle, which ends the reservation', async () => {
    const owner = await newUser();
    const old = freshHandle();
    const next = freshHandle();
    await upsertPublicProfile(owner, { handle: old }, db);
    await upsertPublicProfile(owner, { handle: next }, db);

    const reclaimed = await upsertPublicProfile(owner, { handle: old }, db);

    expect(reclaimed.handle).toBe(old);
    expect(await reservation(old)).toBeNull();
    expect(await reservation(next)).toBe(owner);
  });

  it('keeps the handle of a deleted account reserved', async () => {
    const leaving = await newUser();
    const other = await newUser();
    const handle = freshHandle();
    await upsertPublicProfile(leaving, { handle }, db);

    // As the role Supabase Auth deletes accounts with, when this session may
    // assume it: it holds no grant on released_handles, and the cascade must
    // still record the handle.
    const [{ asAuth }] = await pg()`
      SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin')
        THEN pg_has_role(current_user, 'supabase_auth_admin', 'USAGE') ELSE false END AS "asAuth"
    `;
    await pg().begin(async (tx) => {
      if (asAuth) await tx`SET LOCAL ROLE supabase_auth_admin`;
      await tx`DELETE FROM auth.users WHERE id = ${leaving}`;
    });

    expect(await reservation(handle)).toBe(leaving);
    await expect(
      upsertPublicProfile(other, { handle }, db)
    ).rejects.toMatchObject(HANDLE_TAKEN);
  });

  it('makes a claim racing the release of the same handle wait, then refuses it', async () => {
    const owner = await newUser();
    const other = await newUser();
    const old = freshHandle();
    await upsertPublicProfile(owner, { handle: old }, db);

    let releaseGate = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    let released = () => {};
    const releasedSignal = new Promise<void>((resolve) => {
      released = resolve;
    });
    const releasing = pg().begin(async (tx) => {
      await tx`UPDATE public.public_profiles SET handle = ${freshHandle()} WHERE user_id = ${owner}`;
      released();
      await gate;
    });
    await releasedSignal;
    // Lazy query: started now, while the release is still uncommitted.
    const claim =
      pg()`UPDATE public.public_profiles SET handle = ${old} WHERE user_id = ${other}`.then(
        () => 'claimed',
        (error: { code?: string }) => error.code
      );
    await new Promise((resolve) => setTimeout(resolve, 200));
    releaseGate();
    await releasing;

    expect(await claim).toBe('23505');
    expect(await reservation(old)).toBe(owner);
  });
});
