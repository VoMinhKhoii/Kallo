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
