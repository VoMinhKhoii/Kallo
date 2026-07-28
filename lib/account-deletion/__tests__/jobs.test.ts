import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { authUserIsConfirmedAbsent } = await import(
  '@/lib/account-deletion/jobs'
);

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
