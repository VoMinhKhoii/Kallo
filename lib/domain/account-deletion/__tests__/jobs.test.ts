import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockDeleteRevenueCatCustomer } = vi.hoisted(() => ({
  mockDeleteRevenueCatCustomer: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/domain/billing/revenuecat/customer', () => ({
  deleteRevenueCatCustomer: mockDeleteRevenueCatCustomer,
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
} = await import('@/lib/domain/account-deletion/jobs');

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
      prepareAccountDeletion('11111111-1111-4111-8111-111111111111', {
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
