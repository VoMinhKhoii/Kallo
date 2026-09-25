import { generateKeyPairSync } from 'node:crypto';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockOpen, mockReadSealed, mockGetUserById } = vi.hoisted(() => ({
  mockOpen: vi.fn(),
  mockReadSealed: vi.fn(),
  mockGetUserById: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/infra/db/client', () => ({ db: {} }));
vi.mock('@/lib/domain/apple-sign-in/refresh-tokens', () => ({
  openAppleRefreshToken: mockOpen,
  readSealedAppleRefreshToken: mockReadSealed,
}));
vi.mock('@/lib/domain/account-deletion/jobs', () => ({
  authUserIsConfirmedAbsent: (
    user: unknown,
    error: { status?: number } | null
  ) => !user && (!error || error.status === 404),
}));
vi.mock('@/lib/infra/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById: mockGetUserById } },
  }),
}));

const {
  MAX_ATTEMPTS,
  claimAppleRevocation,
  enqueueAppleRevocation,
  processAppleRevocation,
  retryAppleRevocations,
} = await import('@/lib/domain/apple-sign-in/revocation-outbox');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ROW = { id: 'rev-1', userId: USER_ID, refreshTokenCiphertext: 'v1:s' };
const CLAIMED_AT = new Date('2026-09-25T12:00:00.000Z');
const fetchMock = vi.fn();
const dialect = new PgDialect();

/** `update().set().where()` — awaitable directly AND via `.returning()`. */
function updateChain(returningRows: unknown[] = []) {
  const returning = vi.fn().mockResolvedValue(returningRows);
  const where = vi.fn(() =>
    Object.assign(Promise.resolve(undefined), { returning })
  );
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { update, set, where, returning };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Real Apple client against a stubbed network: the invalid_grant → success
  // rule lives there, and this suite checks the outbox honours it.
  const { privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  vi.stubEnv('APPLE_TEAM_ID', 'TEAM98765');
  vi.stubEnv('APPLE_SIGNIN_CLIENT_ID', 'com.khoivo.nham');
  vi.stubEnv('APPLE_SIGNIN_KEY_ID', 'KEY1234567');
  vi.stubEnv('APPLE_SIGNIN_KEY_P8', privateKey);
  vi.stubGlobal('fetch', fetchMock);
  mockOpen.mockReturnValue('rt-plain');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('enqueueAppleRevocation', () => {
  it('queues nothing for an account that never linked a token', async () => {
    mockReadSealed.mockResolvedValue(null);
    const insert = vi.fn();
    await expect(
      enqueueAppleRevocation(USER_ID, { insert } as never)
    ).resolves.toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it('refreshes a still-pending row with the newest token, due now', async () => {
    mockReadSealed.mockResolvedValue('v1:newest');
    const returning = vi.fn().mockResolvedValue([{ id: 'rev-1' }]);
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = vi.fn().mockReturnValue({ values });

    await expect(
      enqueueAppleRevocation(USER_ID, { insert } as never)
    ).resolves.toEqual({ id: 'rev-1' });
    expect(values.mock.calls[0]?.[0]).toMatchObject({
      userId: USER_ID,
      refreshTokenCiphertext: 'v1:newest',
    });
    const conflict = onConflictDoUpdate.mock.calls[0]?.[0];
    expect(conflict.set).toEqual({
      refreshTokenCiphertext: 'v1:newest',
      nextAttemptAt: expect.any(Date),
    });
    // Only the pending row is updated; completed/dead history is left alone.
    expect(dialect.sqlToQuery(conflict.targetWhere as SQL).sql).toBe(
      "status = 'pending'"
    );
  });
});

describe('claimAppleRevocation', () => {
  it('returns the fresh row and the claim fence, or null when not due', async () => {
    const chain = updateChain([ROW]);
    await expect(
      claimAppleRevocation('rev-1', chain as never)
    ).resolves.toEqual({ row: ROW, claimedAt: expect.any(Date) });
    expect(chain.set).toHaveBeenCalledWith({
      lastAttemptAt: expect.any(Date),
      nextAttemptAt: expect.any(Date),
    });

    await expect(
      claimAppleRevocation('rev-1', updateChain([]) as never)
    ).resolves.toBeNull();
  });
});

describe('processAppleRevocation', () => {
  it('revokes, then completes the row and wipes the sealed token', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const chain = updateChain();

    await expect(
      processAppleRevocation(ROW, CLAIMED_AT, chain as never)
    ).resolves.toBe('completed');
    expect(mockOpen).toHaveBeenCalledWith(USER_ID, 'v1:s');
    const form = new URLSearchParams(fetchMock.mock.calls[0]?.[1].body);
    expect(form.get('token')).toBe('rt-plain');
    expect(chain.set).toHaveBeenCalledWith({
      status: 'completed',
      refreshTokenCiphertext: null,
      completedAt: expect.any(Date),
      lastError: null,
    });
  });

  it('completes the row when Apple says the token is already dead', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'invalid_grant' }));
    const chain = updateChain();
    await expect(
      processAppleRevocation(ROW, CLAIMED_AT, chain as never)
    ).resolves.toBe('completed');
    expect(chain.set.mock.calls[0]?.[0].status).toBe('completed');
  });

  it('schedules a retry on failure and keeps the token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'invalid_client' }));
    const chain = updateChain([{ status: 'pending' }]);

    await expect(
      processAppleRevocation(ROW, CLAIMED_AT, chain as never)
    ).resolves.toBe('retry');
    const retry = chain.set.mock.calls[0]?.[0];
    expect(retry.lastError).toBe('apple_token_revoke_upstream_error');
    expect(retry).not.toHaveProperty('refreshTokenCiphertext');
    const status = dialect.sqlToQuery(retry.status as SQL);
    expect(status.sql).toContain(
      `"attempt_count" + 1 >= $1 THEN 'dead' ELSE 'pending' END`
    );
    expect(status.params).toEqual([MAX_ATTEMPTS]);
  });

  it('parks the row as dead at the attempt cap, loudly', async () => {
    mockOpen.mockImplementation(() => {
      throw new Error('apple_token_encryption_key_unavailable');
    });
    const chain = updateChain([{ status: 'dead' }]);

    await expect(
      processAppleRevocation(ROW, CLAIMED_AT, chain as never)
    ).resolves.toBe('dead');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`gave up after ${MAX_ATTEMPTS} attempts`)
    );
  });
});

describe('retryAppleRevocations', () => {
  function database(candidates: unknown[], claimed: unknown[]) {
    const limit = vi.fn().mockResolvedValue(candidates);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    return { select, ...updateChain(claimed) };
  }

  it('skips a row whose auth user still exists', async () => {
    mockGetUserById.mockResolvedValue({ data: { user: { id: USER_ID } } });
    const db = database([{ id: 'rev-1', userId: USER_ID }], [ROW]);

    await expect(retryAppleRevocations(db as never)).resolves.toEqual({
      processed: 0,
      failed: 0,
      skipped: 1,
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts a transient Auth probe failure without revoking', async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: null },
      error: { status: 503 },
    });
    const db = database([{ id: 'rev-1', userId: USER_ID }], [ROW]);
    await expect(retryAppleRevocations(db as never)).resolves.toEqual({
      processed: 0,
      failed: 1,
      skipped: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revokes once the user is confirmed gone', async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: null },
      error: { status: 404 },
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const db = database([{ id: 'rev-1', userId: USER_ID }], [ROW]);

    await expect(retryAppleRevocations(db as never)).resolves.toEqual({
      processed: 1,
      failed: 0,
      skipped: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
