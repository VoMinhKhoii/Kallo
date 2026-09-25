import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExchange, mockReadConfig } = vi.hoisted(() => ({
  mockExchange: vi.fn(),
  mockReadConfig: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/infra/db/client', () => ({ db: {} }));
vi.mock('@/lib/infra/apple-auth/apple-auth', () => ({
  exchangeAppleAuthorizationCode: mockExchange,
}));
vi.mock('@/lib/infra/apple-auth/config', () => ({
  readAppleAuthConfig: mockReadConfig,
}));

const {
  linkAppleAuthorizationCode,
  openAppleRefreshToken,
  readSealedAppleRefreshToken,
} = await import('@/lib/domain/apple-sign-in/refresh-tokens');
const { appleSubjectOf } = await import('@/lib/domain/apple-sign-in/contracts');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const INPUT = {
  userId: USER_ID,
  appleSubject: '001.apple',
  authorizationCode: 'code-1',
};

/** A db whose `transaction` runs the callback against a recording tx. */
function insertChain() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  const tx = { insert, update };
  const transaction = vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx));
  const db = { transaction } as never;
  return { db, transaction, insert, values, onConflictDoUpdate, update, set };
}

/** Link once and hand back the ciphertext that was written. */
async function linkAndCapture(): Promise<string> {
  mockExchange.mockResolvedValue({
    ok: true,
    refreshToken: 'rt-plain',
    subject: '001.apple',
  });
  const { db, values } = insertChain();
  await linkAppleAuthorizationCode(INPUT, db);
  return values.mock.calls[0]?.[0].refreshTokenCiphertext;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReadConfig.mockReturnValue({ clientId: 'com.khoivo.nham' });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('linkAppleAuthorizationCode', () => {
  it('stores only a sealed token that opens back to the refresh token', async () => {
    mockExchange.mockResolvedValue({
      ok: true,
      refreshToken: 'rt-plain',
      subject: '001.apple',
    });
    const { db, values, onConflictDoUpdate } = insertChain();

    await expect(linkAppleAuthorizationCode(INPUT, db)).resolves.toBe('stored');
    expect(mockExchange).toHaveBeenCalledWith('code-1');
    const row = values.mock.calls[0]?.[0];
    expect(row.userId).toBe(USER_ID);
    expect(row.refreshTokenCiphertext).toMatch(/^v1:/);
    expect(row.refreshTokenCiphertext).not.toContain('rt-plain');
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({ updatedAt: expect.any(Date) }),
      })
    );
    expect(openAppleRefreshToken(USER_ID, row.refreshTokenCiphertext)).toBe(
      'rt-plain'
    );
  });

  // Codex (#391): a link landing after a deletion enqueued its revocation, but
  // before the auth user is gone, must not leave the older token in the
  // outbox — the auth cascade drops `apple_auth_tokens` right after.
  it('moves the newest token onto a pending revocation, in the same transaction', async () => {
    mockExchange.mockResolvedValue({
      ok: true,
      refreshToken: 'rt-new',
      subject: '001.apple',
    });
    const { db, transaction, values, update, set } = insertChain();

    await expect(linkAppleAuthorizationCode(INPUT, db)).resolves.toBe('stored');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    const stored = values.mock.calls[0]?.[0].refreshTokenCiphertext;
    expect(set).toHaveBeenCalledWith({
      refreshTokenCiphertext: stored,
      nextAttemptAt: expect.any(Date),
    });
    expect(openAppleRefreshToken(USER_ID, stored)).toBe('rt-new');
  });

  it('is a no-op without Apple credentials', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockReadConfig.mockReturnValue(null);
    const { db, insert } = insertChain();
    await expect(linkAppleAuthorizationCode(INPUT, db)).resolves.toBe(
      'not_configured'
    );
    expect(mockExchange).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('never spends the single-use code when the encryption key is malformed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('APPLE_TOKEN_ENCRYPTION_KEY', 'too-short');
    const { db, insert } = insertChain();
    await expect(linkAppleAuthorizationCode(INPUT, db)).resolves.toBe(
      'not_configured'
    );
    expect(mockExchange).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('turns an invalid code into a 400 and an Apple outage into a 500', async () => {
    mockExchange.mockResolvedValueOnce({ ok: false, reason: 'invalid_grant' });
    await expect(
      linkAppleAuthorizationCode(INPUT, insertChain().db)
    ).rejects.toMatchObject({ status: 400 });

    mockExchange.mockResolvedValueOnce({ ok: false, reason: 'timeout' });
    await expect(
      linkAppleAuthorizationCode(INPUT, insertChain().db)
    ).rejects.toMatchObject({ status: 500 });
  });

  it('refuses a code minted for a different Apple identity', async () => {
    mockExchange.mockResolvedValue({
      ok: true,
      refreshToken: 'rt-other',
      subject: '999.someone-else',
    });
    const { db, insert } = insertChain();
    await expect(linkAppleAuthorizationCode(INPUT, db)).rejects.toMatchObject({
      status: 409,
    });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('openAppleRefreshToken', () => {
  it('will not open a token sealed for another user', async () => {
    const sealed = await linkAndCapture();
    expect(() =>
      openAppleRefreshToken('22222222-2222-4222-8222-222222222222', sealed)
    ).toThrow();
  });

  it('throws when the key is unavailable, so the outbox retries', async () => {
    const sealed = await linkAndCapture();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('APPLE_TOKEN_ENCRYPTION_KEY', 'bad');
    expect(() => openAppleRefreshToken(USER_ID, sealed)).toThrow(
      'apple_token_encryption_key_unavailable'
    );
    vi.stubEnv(
      'APPLE_TOKEN_ENCRYPTION_KEY',
      randomBytes(32).toString('base64')
    );
    expect(() => openAppleRefreshToken(USER_ID, sealed)).toThrow();
  });
});

describe('readSealedAppleRefreshToken', () => {
  it('returns the stored ciphertext, or null when never linked', async () => {
    const limit = vi
      .fn()
      .mockResolvedValueOnce([{ ciphertext: 'v1:sealed' }])
      .mockResolvedValueOnce([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    await expect(
      readSealedAppleRefreshToken(USER_ID, { select } as never)
    ).resolves.toBe('v1:sealed');
    await expect(
      readSealedAppleRefreshToken(USER_ID, { select } as never)
    ).resolves.toBeNull();
  });
});

describe('appleSubjectOf', () => {
  it('reads the Apple identity’s sub, falling back to its id', () => {
    expect(
      appleSubjectOf([
        { provider: 'email', id: 'e', identity_data: {} },
        { provider: 'apple', id: 'a-id', identity_data: { sub: 's' } },
      ])
    ).toBe('s');
    expect(
      appleSubjectOf([{ provider: 'apple', id: 'a-id', identity_data: null }])
    ).toBe('a-id');
    expect(appleSubjectOf([])).toBeNull();
    expect(appleSubjectOf(undefined)).toBeNull();
  });
});
