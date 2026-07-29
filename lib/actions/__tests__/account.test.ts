import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuthUserIsConfirmedAbsent,
  mockCreateAdminClient,
  mockDeleteUser,
  mockDbDelete,
  mockDbSelect,
  mockDeleteWhere,
  mockGetUser,
  mockGetClaims,
  mockHeaders,
  mockClaimDeletionJob,
  mockPrepareDeletion,
  mockProcessDeletion,
  mockSignOut,
  mockStorageFrom,
  mockStorageList,
  mockStorageRemove,
} = vi.hoisted(() => ({
  mockAuthUserIsConfirmedAbsent: vi.fn(),
  mockCreateAdminClient: vi.fn(),
  mockDeleteUser: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDeleteWhere: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetClaims: vi.fn(),
  mockHeaders: vi.fn(),
  mockClaimDeletionJob: vi.fn(),
  mockPrepareDeletion: vi.fn(),
  mockProcessDeletion: vi.fn(),
  mockSignOut: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockStorageList: vi.fn(),
  mockStorageRemove: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: mockGetUser,
      getClaims: mockGetClaims,
      signOut: mockSignOut,
    },
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock('@/lib/account-deletion/jobs', () => ({
  authUserIsConfirmedAbsent: mockAuthUserIsConfirmedAbsent,
  claimAccountDeletionJob: mockClaimDeletionJob,
  prepareAccountDeletion: mockPrepareDeletion,
  processAccountDeletionJob: mockProcessDeletion,
}));

vi.mock('@/lib/db', () => ({
  db: { delete: mockDbDelete, select: mockDbSelect },
}));

import { deleteAccountAction, exportMyDataAction } from '@/lib/actions/account';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'owner@kallo.fit',
};
const input = { expectedUserId: user.id };

describe('deleteAccountAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUserIsConfirmedAbsent.mockImplementation(
      (candidate: unknown, error: { status?: number; code?: string } | null) =>
        !candidate &&
        (!error || error.status === 404 || error.code === 'user_not_found')
    );
    mockHeaders.mockResolvedValue(
      new Headers({ authorization: 'Bearer mobile-access-token' })
    );
    mockGetUser.mockResolvedValue({ data: { user }, error: null });
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          amr: [{ method: 'oauth', timestamp: Date.now() / 1000 }],
        },
      },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue({
      auth: { admin: { deleteUser: mockDeleteUser } },
      storage: { from: mockStorageFrom },
    });
    mockStorageFrom.mockReturnValue({
      list: mockStorageList,
      remove: mockStorageRemove,
    });
    mockStorageList.mockResolvedValue({ data: [], error: null });
    mockStorageRemove.mockResolvedValue({ error: null });
    mockDbDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue({ error: null });
    mockPrepareDeletion.mockResolvedValue({ id: 'job-1', userId: user.id });
    mockClaimDeletionJob.mockResolvedValue(
      new Date('2026-07-29T00:00:00.000Z')
    );
    mockProcessDeletion.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
  });

  it('fails before local cleanup when the admin credential is unavailable', async () => {
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error('service_role_missing');
    });

    await expect(deleteAccountAction(input)).rejects.toThrow(
      'service_role_missing'
    );
    expect(mockPrepareDeletion).not.toHaveBeenCalled();
    expect(mockDbDelete).not.toHaveBeenCalled();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('completes local deletion while provider erasure remains queued', async () => {
    mockProcessDeletion.mockRejectedValue(
      new Error('revenuecat_customer_delete_http_503')
    );

    await expect(deleteAccountAction(input)).resolves.toEqual({
      success: true,
    });
    expect(mockDeleteUser).toHaveBeenCalledWith(user.id);
    expect(mockProcessDeletion).toHaveBeenCalledWith(
      {
        id: 'job-1',
        userId: user.id,
      },
      expect.any(Date)
    );
  });

  it('does not delete auth when the first billing cleanup fails', async () => {
    mockDeleteWhere.mockRejectedValueOnce(new Error('cleanup_failed'));

    await expect(deleteAccountAction(input)).rejects.toMatchObject({
      code: 'INTERNAL',
    });
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockPrepareDeletion).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('keeps the session retryable when auth deletion fails', async () => {
    mockDeleteUser.mockResolvedValue({ error: new Error('auth_failed') });

    await expect(deleteAccountAction(input)).rejects.toMatchObject({
      code: 'INTERNAL',
    });
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    expect(mockPrepareDeletion).toHaveBeenCalledWith(user.id);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('treats a concurrent already-deleted account as idempotent success', async () => {
    mockDeleteUser.mockResolvedValue({
      error: { status: 404, code: 'user_not_found' },
    });

    await expect(deleteAccountAction(input)).resolves.toEqual({
      success: true,
    });
    expect(mockPrepareDeletion).toHaveBeenCalledWith(user.id);
    expect(mockClaimDeletionJob).not.toHaveBeenCalled();
    expect(mockProcessDeletion).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('lets only the outbox claimant call RevenueCat during a race', async () => {
    mockClaimDeletionJob.mockResolvedValue(null);

    await expect(deleteAccountAction(input)).resolves.toEqual({
      success: true,
    });
    expect(mockClaimDeletionJob).toHaveBeenCalledWith('job-1');
    expect(mockProcessDeletion).not.toHaveBeenCalled();
  });

  it('finishes deletion when raced post-delete audit cleanup fails', async () => {
    mockDeleteWhere
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('raced_cleanup_failed'));

    await expect(deleteAccountAction(input)).resolves.toEqual({
      success: true,
    });
    expect(mockDeleteUser).toHaveBeenCalledWith(user.id);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('fails closed when avatar purge cannot be confirmed', async () => {
    mockStorageList.mockResolvedValue({
      data: null,
      error: new Error('storage_unavailable'),
    });

    await expect(deleteAccountAction(input)).rejects.toMatchObject({
      code: 'INTERNAL',
    });
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockPrepareDeletion).not.toHaveBeenCalled();
  });

  it('cleans audit rows on both sides of auth deletion and signs out', async () => {
    await expect(deleteAccountAction(input)).resolves.toEqual({
      success: true,
    });
    expect(mockDeleteWhere).toHaveBeenCalledTimes(2);
    expect(mockPrepareDeletion).toHaveBeenCalledWith(user.id);
    expect(mockDeleteUser).toHaveBeenCalledWith(user.id);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockDeleteWhere.mock.invocationCallOrder[0]).toBeLessThan(
      mockStorageFrom.mock.invocationCallOrder[0] as number
    );
    expect(mockStorageFrom.mock.invocationCallOrder[0]).toBeLessThan(
      mockPrepareDeletion.mock.invocationCallOrder[0] as number
    );
    expect(mockPrepareDeletion.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteUser.mock.invocationCallOrder[0] as number
    );
    expect(mockDeleteUser.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteWhere.mock.invocationCallOrder[1] as number
    );
  });

  it('rejects a stale account identity before resolving privileged state', async () => {
    await expect(
      deleteAccountAction({
        expectedUserId: '22222222-2222-4222-8222-222222222222',
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockPrepareDeletion).not.toHaveBeenCalled();
    expect(mockDbDelete).not.toHaveBeenCalled();
    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it('requires a fresh server-verified authentication for deletion', async () => {
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          amr: [{ method: 'oauth', timestamp: Date.now() / 1000 - 601 }],
        },
      },
      error: null,
    });

    await expect(deleteAccountAction(input)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockPrepareDeletion).not.toHaveBeenCalled();
  });

  it('passes the stateless mobile bearer token to the claims verifier', async () => {
    await expect(deleteAccountAction(input)).resolves.toEqual({
      success: true,
    });

    expect(mockGetClaims).toHaveBeenCalledWith('mobile-access-token');
  });

  it('uses the cookie-backed session when no bearer token is present', async () => {
    mockHeaders.mockResolvedValue(new Headers());

    await expect(deleteAccountAction(input)).resolves.toEqual({
      success: true,
    });

    expect(mockGetClaims).toHaveBeenCalledWith(undefined);
  });

  it('rejects stale-tab data export before reading another account', async () => {
    await expect(
      exportMyDataAction({
        expectedUserId: '22222222-2222-4222-8222-222222222222',
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
});
