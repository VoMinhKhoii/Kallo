import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdminSpy, returningSpy, setSpy, revalidateSpy } = vi.hoisted(
  () => ({
    requireAdminSpy: vi.fn(async () => ({ id: 'admin-1', email: 'a@x.com' })),
    returningSpy: vi.fn(async () => [{ id: 'fb-1' }]),
    setSpy: vi.fn(),
    revalidateSpy: vi.fn(),
  })
);

vi.mock('@/lib/infra/db', () => ({
  db: {
    update: () => ({
      set: (values: unknown) => {
        setSpy(values);
        return { where: () => ({ returning: returningSpy }) };
      },
    }),
  },
}));
vi.mock('@/lib/admin/authz/require-admin', () => ({
  requireAdmin: requireAdminSpy,
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidateSpy }));

import { updateFeedbackStatus } from '../update-feedback-status';

const ID = '11111111-1111-4111-a111-111111111111';

describe('updateFeedbackStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    returningSpy.mockResolvedValue([{ id: 'fb-1' }]);
  });

  it('requires an admin before touching the row', async () => {
    await updateFeedbackStatus({ id: ID, status: 'triaged' });
    expect(requireAdminSpy).toHaveBeenCalledOnce();
  });

  it('writes the new status and refreshes updatedAt', async () => {
    const result = await updateFeedbackStatus({ id: ID, status: 'resolved' });
    expect(result).toEqual({ success: true });
    const values = setSpy.mock.calls[0][0] as {
      status: string;
      updatedAt: Date;
    };
    expect(values.status).toBe('resolved');
    expect(values.updatedAt).toBeInstanceOf(Date);
  });

  it('revalidates both the detail and list routes', async () => {
    await updateFeedbackStatus({ id: ID, status: 'wontfix' });
    expect(revalidateSpy).toHaveBeenCalledWith(`/admin/feedback/${ID}`);
    expect(revalidateSpy).toHaveBeenCalledWith('/admin/feedback');
  });

  it('rejects a non-uuid id', async () => {
    await expect(
      updateFeedbackStatus({ id: 'nope', status: 'open' })
    ).rejects.toThrow();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('rejects a status outside the FEEDBACK_STATUSES enum', async () => {
    await expect(
      updateFeedbackStatus({ id: ID, status: 'archived' })
    ).rejects.toThrow();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('throws notFound when the update matched no row', async () => {
    returningSpy.mockResolvedValueOnce([]);
    await expect(
      updateFeedbackStatus({ id: ID, status: 'open' })
    ).rejects.toThrow(/not found/i);
    expect(revalidateSpy).not.toHaveBeenCalled();
  });
});
