import type { AuthError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { weakPasswordReason } from '@/lib/infra/auth/weak-password';

const authError = (fields: Record<string, unknown>) =>
  ({ message: 'x', ...fields }) as unknown as AuthError;

describe('weakPasswordReason', () => {
  it('is null for any other failure', () => {
    expect(weakPasswordReason(authError({ status: 429 }))).toBeNull();
    expect(
      weakPasswordReason(authError({ code: 'invalid_credentials' }))
    ).toBeNull();
  });

  it('reads a policy refusal as weak', () => {
    expect(
      weakPasswordReason(
        authError({ code: 'weak_password', reasons: ['length', 'characters'] })
      )
    ).toBe('weak');
    // A relayed body can lose the reasons list; still a weak password.
    expect(weakPasswordReason(authError({ code: 'weak_password' }))).toBe(
      'weak'
    );
  });

  it('singles out a breached password (leaked password protection)', () => {
    expect(
      weakPasswordReason(
        authError({ code: 'weak_password', reasons: ['pwned'] })
      )
    ).toBe('pwned');
  });
});
