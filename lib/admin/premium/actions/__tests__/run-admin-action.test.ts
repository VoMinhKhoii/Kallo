import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Errors } from '@/lib/core/errors/catalog';

const { requireAdminSpy, revalidateSpy } = vi.hoisted(() => ({
  requireAdminSpy: vi.fn(async () => ({ id: 'admin-1', email: 'a@x.com' })),
  revalidateSpy: vi.fn(),
}));

vi.mock('@/lib/admin/authz/require-admin', () => ({
  requireAdmin: requireAdminSpy,
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidateSpy }));

import { runAdminAction } from '../run-admin-action';

const schema = z.object({ days: z.number().max(365, 'At most 365 days.') });

describe('runAdminAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('refuses a non-admin before parsing or running anything', async () => {
    const notFound = new Error('NEXT_HTTP_ERROR_FALLBACK;404');
    requireAdminSpy.mockRejectedValueOnce(notFound);
    const run = vi.fn();

    await expect(runAdminAction('test', schema, { days: 1 }, run)).rejects.toBe(
      notFound
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('returns the validation message and runs nothing on bad input', async () => {
    const run = vi.fn();
    const result = await runAdminAction('test', schema, { days: 999 }, run);
    expect(result).toEqual({ success: false, error: 'At most 365 days.' });
    expect(run).not.toHaveBeenCalled();
  });

  it('runs with the admin and parsed input, then refreshes the pages', async () => {
    const run = vi.fn(async () => ({ userCount: 3 }));
    const result = await runAdminAction('test', schema, { days: 7 }, run);

    expect(run).toHaveBeenCalledWith(
      { id: 'admin-1', email: 'a@x.com' },
      { days: 7 }
    );
    expect(result).toEqual({ success: true, userCount: 3 });
    expect(revalidateSpy).toHaveBeenCalledOnce();
  });

  it('a read neither logs nor refreshes', async () => {
    await runAdminAction('read', schema, { days: 1 }, async () => ({}), {
      mutates: false,
    });
    expect(revalidateSpy).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });

  it('surfaces a 400 as the form message and hides anything else', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = await runAdminAction('test', schema, { days: 1 }, async () => {
      throw Errors.validationFailed('Pick a date in the future.');
    });
    expect(bad).toEqual({
      success: false,
      error: 'Pick a date in the future.',
    });

    const boom = await runAdminAction('test', schema, { days: 1 }, async () => {
      throw new Error('connection reset');
    });
    expect(boom).toEqual({
      success: false,
      error: 'Something went wrong. Try again.',
    });
  });
});
