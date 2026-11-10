// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { exportMyDataAction, toastError } = vi.hoisted(() => ({
  exportMyDataAction: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('@/lib/actions/identity/account', () => ({
  exportMyDataAction,
  deleteAccountAction: vi.fn(),
}));
vi.mock('@/lib/infra/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('sonner', () => ({ toast: { error: toastError } }));

import { useAccountActions } from '@/components/settings/account/use-account-actions';
import { createClient } from '@/lib/infra/supabase/client';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('account export download', () => {
  it('shows localized retry copy without downloading a throttle envelope', async () => {
    exportMyDataAction.mockResolvedValue({
      error: { code: 'RATE_LIMITED', status: 429 },
      retryAfterSeconds: 5,
    });
    const { result } = renderHook(() => useAccountActions('owner'));
    const createElement = vi.spyOn(document, 'createElement');
    await act(() => result.current.handleExport());
    expect(toastError).toHaveBeenCalledExactlyOnceWith('exportRateLimited');
    expect(createElement).not.toHaveBeenCalled();
    expect(result.current.exportPending).toBe(false);
    expect(exportMyDataAction).toHaveBeenCalledExactlyOnceWith({
      expectedUserId: 'owner',
    });
  });

  it('preserves the generic localized failure for an export read error', async () => {
    exportMyDataAction.mockRejectedValue(new Error('statement timeout'));
    const { result } = renderHook(() => useAccountActions('owner'));
    await act(() => result.current.handleExport());
    expect(toastError).toHaveBeenCalledExactlyOnceWith('exportError');
    expect(result.current.exportPending).toBe(false);
  });
});

describe('account sign-out', () => {
  // A rejected sign-out keeps the hook off `window.location.assign`, which
  // jsdom does not implement; only the scope passed to Supabase is checked.
  it('passes scope local to signOut, so the iOS session is not revoked', async () => {
    const signOut = vi
      .fn()
      .mockResolvedValue({ error: new Error('sign-out failed') });
    vi.mocked(createClient).mockReturnValue({
      auth: { signOut },
    } as unknown as ReturnType<typeof createClient>);
    const { result } = renderHook(() => useAccountActions('owner'));
    await act(() => result.current.handleSignOut());
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
  });
});
