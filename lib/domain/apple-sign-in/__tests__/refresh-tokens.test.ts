import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExchange, mockRevoke, mockReadConfig } = vi.hoisted(() => ({
  mockExchange: vi.fn(),
  mockRevoke: vi.fn(),
  mockReadConfig: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/infra/db/client', () => ({ db: {} }));
vi.mock('@/lib/infra/apple-auth/apple-auth', () => ({
  exchangeAppleAuthorizationCode: mockExchange,
  revokeAppleRefreshToken: mockRevoke,
}));
vi.mock('@/lib/infra/apple-auth/config', () => ({
  readAppleAuthConfig: mockReadConfig,
}));

const {
  linkAppleAuthorizationCode,
  readSealedAppleRefreshToken,
  revokeSealedAppleRefreshToken,
} = await import('@/lib/domain/apple-sign-in/refresh-tokens');
const { appleSubjectOf } = await import('@/lib/domain/apple-sign-in/contracts');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const INPUT = {
  userId: USER_ID,
  appleSubject: '001.apple',
  authorizationCode: 'code-1',
};

function insertChain() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values, onConflictDoUpdate };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReadConfig.mockReturnValue({ clientId: 'com.khoivo.nham' });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('linkAppleAuthorizationCode', () => {
  it('stores only a sealed token that opens back to the refresh token', async () => {
    mockExchange.mockResolvedValue({
      ok: true,
      refreshToken: 'rt-plain',
      subject: '001.apple',
    });
    const { insert, values, onConflictDoUpdate } = insertChain();

    await expect(
      linkAppleAuthorizationCode(INPUT, { insert } as never)
    ).resolves.toBe('stored');
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

    mockRevoke.mockResolvedValue({ ok: true });
    await revokeSealedAppleRefreshToken(USER_ID, row.refreshTokenCiphertext);
    expect(mockRevoke).toHaveBeenCalledWith('rt-plain');
  });

  it('is a no-op without Apple credentials', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockReadConfig.mockReturnValue(null);
    const { insert } = insertChain();
    await expect(
      linkAppleAuthorizationCode(INPUT, { insert } as never)
    ).resolves.toBe('not_configured');
    expect(mockExchange).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('turns an invalid code into a 400 and an Apple outage into a 500', async () => {
    mockExchange.mockResolvedValueOnce({ ok: false, reason: 'invalid_grant' });
    await expect(
      linkAppleAuthorizationCode(INPUT, insertChain() as never)
    ).rejects.toMatchObject({ status: 400 });

    mockExchange.mockResolvedValueOnce({ ok: false, reason: 'timeout' });
    await expect(
      linkAppleAuthorizationCode(INPUT, insertChain() as never)
    ).rejects.toMatchObject({ status: 500 });
  });

  it('refuses a code minted for a different Apple identity', async () => {
    mockExchange.mockResolvedValue({
      ok: true,
      refreshToken: 'rt-other',
      subject: '999.someone-else',
    });
    const { insert } = insertChain();
    await expect(
      linkAppleAuthorizationCode(INPUT, { insert } as never)
    ).rejects.toMatchObject({ status: 409 });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('revokeSealedAppleRefreshToken', () => {
  it('throws so the deletion job retries when Apple refuses', async () => {
    mockExchange.mockResolvedValue({
      ok: true,
      refreshToken: 'rt-plain',
      subject: '001.apple',
    });
    const { insert, values } = insertChain();
    await linkAppleAuthorizationCode(INPUT, { insert } as never);
    const sealed = values.mock.calls[0]?.[0].refreshTokenCiphertext;

    mockRevoke.mockResolvedValue({ ok: false, reason: 'upstream_error' });
    await expect(
      revokeSealedAppleRefreshToken(USER_ID, sealed)
    ).rejects.toThrow('apple_token_revoke_upstream_error');
  });

  it('will not open a token sealed for another user', async () => {
    mockExchange.mockResolvedValue({
      ok: true,
      refreshToken: 'rt-plain',
      subject: '001.apple',
    });
    const { insert, values } = insertChain();
    await linkAppleAuthorizationCode(INPUT, { insert } as never);
    const sealed = values.mock.calls[0]?.[0].refreshTokenCiphertext;

    await expect(
      revokeSealedAppleRefreshToken(
        '22222222-2222-4222-8222-222222222222',
        sealed
      )
    ).rejects.toThrow();
    expect(mockRevoke).not.toHaveBeenCalled();
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
    const base = { user_id: 'u', identity_id: 'i' };
    expect(
      appleSubjectOf([
        { ...base, provider: 'email', id: 'e', identity_data: {} },
        { ...base, provider: 'apple', id: 'a-id', identity_data: { sub: 's' } },
      ])
    ).toBe('s');
    expect(
      appleSubjectOf([
        { ...base, provider: 'apple', id: 'a-id', identity_data: {} },
      ])
    ).toBe('a-id');
    expect(appleSubjectOf([])).toBeNull();
    expect(appleSubjectOf(undefined)).toBeNull();
  });
});
