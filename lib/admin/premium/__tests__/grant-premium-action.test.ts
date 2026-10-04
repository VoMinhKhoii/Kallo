import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';

const { requireAdminSpy, grantPremiumSpy, revalidateSpy } = vi.hoisted(() => ({
  requireAdminSpy: vi.fn(async () => ({ id: 'admin-1', email: 'a@x.com' })),
  grantPremiumSpy: vi.fn(),
  revalidateSpy: vi.fn(),
}));

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));
vi.mock('@/lib/admin/authz/require-admin', () => ({
  requireAdmin: requireAdminSpy,
}));
vi.mock('@/lib/admin/premium/grant-premium', () => ({
  grantPremium: grantPremiumSpy,
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidateSpy }));

import { grantPremiumAction } from '../grant-premium-action';

const EXPIRES = new Date('2026-10-18T00:00:00.000Z');

describe('grantPremiumAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    grantPremiumSpy.mockResolvedValue({
      auditId: 'audit-1',
      userCount: 2,
      expiresAt: EXPIRES,
    });
  });

  it('refuses a non-admin before parsing or writing anything', async () => {
    const notFound = new Error('NEXT_HTTP_ERROR_FALLBACK;404');
    requireAdminSpy.mockRejectedValueOnce(notFound);

    await expect(
      grantPremiumAction({ scope: 'everyone', days: 14 })
    ).rejects.toBe(notFound);
    expect(grantPremiumSpy).not.toHaveBeenCalled();
  });

  it('returns the validation message and writes nothing on bad input', async () => {
    const result = await grantPremiumAction({ scope: 'everyone', days: 9999 });
    expect(result).toEqual({ success: false, error: 'At most 365 days.' });
    expect(grantPremiumSpy).not.toHaveBeenCalled();
  });

  it('grants with the admin identity and the parsed input', async () => {
    const result = await grantPremiumAction({
      scope: 'users',
      days: '7',
      emails: ['B@x.com'],
    });

    expect(grantPremiumSpy).toHaveBeenCalledWith(
      { id: 'admin-1', email: 'a@x.com' },
      { scope: 'users', days: 7, emails: ['b@x.com'] },
      { db: {} }
    );
    expect(result).toEqual({
      success: true,
      userCount: 2,
      expiresAt: EXPIRES.toISOString(),
    });
    expect(revalidateSpy).toHaveBeenCalledWith(
      '/[locale]/admin/premium',
      'page'
    );
  });

  it('surfaces an unknown-email error as the form message', async () => {
    grantPremiumSpy.mockRejectedValueOnce(
      Errors.validationFailed('No account for: c@x.com')
    );
    const result = await grantPremiumAction({
      scope: 'users',
      days: 7,
      emails: ['c@x.com'],
    });
    expect(result).toEqual({
      success: false,
      error: 'No account for: c@x.com',
    });
  });

  it('hides unexpected failures behind a generic message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    grantPremiumSpy.mockRejectedValueOnce(new Error('connection reset'));
    const result = await grantPremiumAction({ scope: 'everyone', days: 7 });
    expect(result).toEqual({
      success: false,
      error: 'Could not grant Premium. Try again.',
    });
  });
});
