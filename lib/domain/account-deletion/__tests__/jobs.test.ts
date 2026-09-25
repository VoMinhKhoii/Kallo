import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockDeleteRevenueCatCustomer, mockRevokeSealedAppleToken } = vi.hoisted(
  () => ({
    mockDeleteRevenueCatCustomer: vi.fn(),
    mockRevokeSealedAppleToken: vi.fn(),
  })
);

vi.mock('server-only', () => ({}));
vi.mock('@/lib/domain/billing/revenuecat/customer', () => ({
  deleteRevenueCatCustomer: mockDeleteRevenueCatCustomer,
}));
vi.mock('@/lib/domain/apple-sign-in/refresh-tokens', () => ({
  revokeSealedAppleRefreshToken: mockRevokeSealedAppleToken,
}));
vi.mock('@/lib/infra/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById: vi.fn() } },
  }),
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

const {
  authUserIsConfirmedAbsent,
  claimAccountDeletionJob,
  prepareAccountDeletion,
  processAccountDeletionJob,
  retryAccountDeletionJobs,
} = await import('@/lib/domain/account-deletion/jobs');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CLAIMED_AT = new Date('2026-07-29T00:00:00.000Z');

/** An `update().set().where()` chain; `where` is awaitable AND `.returning`. */
function updateChain(returningRows: unknown[] = [{ id: 'job-1' }]) {
  const where = vi.fn(() =>
    Object.assign(Promise.resolve(undefined), {
      returning: vi.fn().mockResolvedValue(returningRows),
    })
  );
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { update, set, where };
}

describe('account deletion retry auth probe', () => {
  it('treats explicit Supabase not-found responses as committed deletion', () => {
    expect(
      authUserIsConfirmedAbsent(null, {
        status: 404,
        code: 'user_not_found',
      })
    ).toBe(true);
  });

  it('does not erase provider data on a transient auth-admin failure', () => {
    expect(
      authUserIsConfirmedAbsent(null, {
        status: 503,
        code: 'service_unavailable',
      })
    ).toBe(false);
    expect(authUserIsConfirmedAbsent({ id: 'still-live' }, null)).toBe(false);
  });
});

describe('account deletion outbox preparation', () => {
  it('reuses a racing row without resetting its lifecycle state', async () => {
    vi.stubEnv('BILLING_ENVIRONMENT', 'sandbox');
    const returning = vi.fn().mockResolvedValue([]);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });
    const limit = vi.fn().mockResolvedValue([{ id: 'existing-job' }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    await expect(
      prepareAccountDeletion('11111111-1111-4111-8111-111111111111', {}, {
        insert,
        select,
      } as never)
    ).resolves.toEqual({
      id: 'existing-job',
      userId: '11111111-1111-4111-8111-111111111111',
    });
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(1);
    const inserted = values.mock.calls[0]?.[0];
    expect(inserted.externalEventId).toMatch(/^account-deletion:[0-9a-f]{64}$/);
    expect(inserted.externalEventId).not.toContain(
      '11111111-1111-4111-8111-111111111111'
    );
  });
});

describe('account deletion outbox processing', () => {
  it('acquires a leased processing claim with compare-and-set', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'job-1' }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });

    await expect(
      claimAccountDeletionJob('job-1', { update } as never)
    ).resolves.toEqual(expect.any(Date));
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ACCOUNT_DELETION_PROCESSING',
        lastAttemptAt: expect.any(Date),
        nextAttemptAt: expect.any(Date),
      })
    );
  });

  it('scrubs user data into a completed tombstone after provider success', async () => {
    mockDeleteRevenueCatCustomer.mockResolvedValue(undefined);
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });

    await processAccountDeletionJob(
      {
        id: 'job-1',
        userId: '11111111-1111-4111-8111-111111111111',
      },
      new Date('2026-07-29T00:00:00.000Z'),
      { update } as never
    );
    expect(mockDeleteRevenueCatCustomer).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ACCOUNT_DELETION_COMPLETED',
        rawPayload: { accountDeletion: { completed: true } },
        processedAt: expect.any(Date),
        processingError: null,
        nextAttemptAt: null,
      })
    );
  });
});

describe('account deletion outbox — Sign in with Apple', () => {
  it('stores the sealed Apple token in the payload and on the job', async () => {
    vi.stubEnv('BILLING_ENVIRONMENT', 'sandbox');
    const returning = vi.fn().mockResolvedValue([{ id: 'job-1' }]);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });

    await expect(
      prepareAccountDeletion(USER_ID, { appleRefreshToken: 'v1:sealed' }, {
        insert,
      } as never)
    ).resolves.toEqual({
      id: 'job-1',
      userId: USER_ID,
      appleRefreshToken: 'v1:sealed',
    });
    expect(values.mock.calls[0]?.[0].rawPayload).toEqual({
      accountDeletion: { userId: USER_ID, appleRefreshToken: 'v1:sealed' },
    });
  });

  it('keeps the payload shape unchanged when no Apple token was linked', async () => {
    vi.stubEnv('BILLING_ENVIRONMENT', 'sandbox');
    const returning = vi.fn().mockResolvedValue([{ id: 'job-1' }]);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });

    await expect(
      prepareAccountDeletion(USER_ID, { appleRefreshToken: null }, {
        insert,
      } as never)
    ).resolves.toEqual({ id: 'job-1', userId: USER_ID });
    expect(values.mock.calls[0]?.[0].rawPayload).toEqual({
      accountDeletion: { userId: USER_ID },
    });
  });

  it('revokes the Apple token before erasing the RevenueCat customer', async () => {
    mockRevokeSealedAppleToken.mockResolvedValue(undefined);
    mockDeleteRevenueCatCustomer.mockResolvedValue(undefined);
    const { update, set } = updateChain();

    await processAccountDeletionJob(
      { id: 'job-1', userId: USER_ID, appleRefreshToken: 'v1:sealed' },
      CLAIMED_AT,
      { update } as never
    );
    expect(mockRevokeSealedAppleToken).toHaveBeenCalledWith(
      USER_ID,
      'v1:sealed'
    );
    expect(mockRevokeSealedAppleToken.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteRevenueCatCustomer.mock.invocationCallOrder[0] as number
    );
    // Completion wipes the payload, sealed token included.
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ACCOUNT_DELETION_COMPLETED',
        rawPayload: { accountDeletion: { completed: true } },
      })
    );
  });

  it('requeues for retry, without touching RevenueCat, when revocation fails', async () => {
    mockRevokeSealedAppleToken.mockRejectedValue(
      new Error('apple_token_revoke_timeout')
    );
    const { update, set } = updateChain();

    await expect(
      processAccountDeletionJob(
        { id: 'job-1', userId: USER_ID, appleRefreshToken: 'v1:sealed' },
        CLAIMED_AT,
        { update } as never
      )
    ).rejects.toThrow('apple_token_revoke_timeout');
    expect(mockDeleteRevenueCatCustomer).not.toHaveBeenCalled();
    const retry = set.mock.calls[0]?.[0];
    expect(retry).toEqual(
      expect.objectContaining({
        eventType: 'ACCOUNT_DELETION_READY',
        processingError: 'apple_token_revoke_timeout',
      })
    );
    // The retry keeps the payload (and so the token) for the next attempt.
    expect(retry).not.toHaveProperty('rawPayload');
  });

  it('skips revocation for a job with no Apple token', async () => {
    mockDeleteRevenueCatCustomer.mockResolvedValue(undefined);
    const { update } = updateChain();

    await processAccountDeletionJob(
      { id: 'job-1', userId: USER_ID },
      CLAIMED_AT,
      {
        update,
      } as never
    );
    expect(mockRevokeSealedAppleToken).not.toHaveBeenCalled();
    expect(mockDeleteRevenueCatCustomer).toHaveBeenCalledWith(USER_ID);
  });

  it('retries both old (pre-Apple) and new payload shapes from the outbox', async () => {
    vi.stubEnv('BILLING_ENVIRONMENT', 'sandbox');
    mockRevokeSealedAppleToken.mockResolvedValue(undefined);
    mockDeleteRevenueCatCustomer.mockResolvedValue(undefined);
    const limit = vi.fn().mockResolvedValue([
      {
        id: 'old-job',
        eventType: 'ACCOUNT_DELETION_READY',
        rawPayload: { accountDeletion: { userId: USER_ID } },
      },
      {
        id: 'new-job',
        eventType: 'ACCOUNT_DELETION_READY',
        rawPayload: {
          accountDeletion: { userId: USER_ID, appleRefreshToken: 'v1:sealed' },
        },
      },
    ]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const { update } = updateChain();

    await expect(
      retryAccountDeletionJobs({ select, update } as never)
    ).resolves.toEqual({ processed: 2, failed: 0, skipped: 0 });
    expect(mockRevokeSealedAppleToken).toHaveBeenCalledTimes(1);
    expect(mockRevokeSealedAppleToken).toHaveBeenCalledWith(
      USER_ID,
      'v1:sealed'
    );
    expect(mockDeleteRevenueCatCustomer).toHaveBeenCalledTimes(2);
  });
});
