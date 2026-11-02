import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MealInputHandle } from '@/lib/domain/logging/meal-input-handle';

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
  assign: vi.fn(),
  unsubscribe: vi.fn(),
  authChange: null as null | ((event: string) => void),
}));
vi.mock('@/lib/infra/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: mocks.signOut,
      onAuthStateChange: (callback: (event: string) => void) => {
        mocks.authChange = callback;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    },
  }),
}));
vi.mock('@/lib/actions/identity/account', () => ({
  deleteAccountAction: mocks.deleteAccount,
  exportMyDataAction: vi.fn(),
}));
vi.mock('@/hooks/meals/queries/use-ingredient-search', () => ({
  useIngredientSearch: () => ({ data: [], isFetching: false }),
}));
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  vi.useFakeTimers();
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.deleteAccount.mockResolvedValue({ success: true });
  mocks.assign.mockImplementation(() =>
    window.dispatchEvent(new Event('beforeunload'))
  );
  vi.stubGlobal('location', { ...window.location, assign: mocks.assign });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mountDraft() {
  const { MealInput } = await import(
    '@/components/logging/input/composer/meal-input'
  );
  const { writeDraft, writeManualRowsDraft } = await import(
    '@/lib/domain/logging/meal-input-draft'
  );
  const { writeStagedDraft } = await import('@/lib/domain/logging/relog/draft');
  const { useStagedEntries } = await import(
    '@/hooks/meals/relog/use-staged-entries'
  );
  writeDraft('private text', 'A');
  writeManualRowsDraft(
    [{ id: 'row', query: 'private row', ingredient: null, grams: '150' }],
    'A'
  );
  writeStagedDraft(
    [
      {
        stageId: 'stage',
        ref: { kind: 'meal', sourceMealId: 'source' },
        label: 'private lunch',
        partCount: 1,
        summary: {
          totalGrams: 150,
          caloriesKcal: 200,
          proteinG: 10,
          carbohydrateG: 20,
          fatG: 9,
        },
      },
    ],
    'A'
  );
  localStorage.setItem('nham:meal-input-draft:other-user', 'other draft');
  localStorage.setItem('unrelated', 'keep');
  const ref = createRef<MealInputHandle>();
  const input = render(<MealInput userId="A" ref={ref} onSubmit={() => {}} />);
  const staged = renderHook(() => useStagedEntries('A'));
  expect(screen.getByRole('textbox')).toHaveValue('private text');
  expect(ref.current?.getManualRows()[0].query).toBe('private row');
  expect(staged.result.current.entries[0].label).toBe('private lunch');
  // Leave the textarea debounce and the staged-list timer pending on exit.
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'pending private text' },
  });
  return { MealInput, useStagedEntries, ref, input, staged };
}

describe('composer account exits', () => {
  it.each([
    'menu',
    'settings',
    'delete',
    'auth-event',
  ] as const)('%s clears persisted drafts and blocks late flushes before a fresh composer mounts', async (exit) => {
    const mounted = await mountDraft();
    if (exit === 'auth-event') {
      const { ComposerDraftSession } = await import(
        '@/components/providers/composer-draft-session'
      );
      const listener = render(<ComposerDraftSession />);
      act(() => mocks.authChange?.('TOKEN_REFRESHED'));
      expect(localStorage.getItem('nham:meal-input-draft:A')).toBe(
        'private text'
      );
      act(() => mocks.authChange?.('SIGNED_OUT'));
      listener.unmount();
      expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    } else if (exit === 'menu') {
      const { useSignOut } = await import('@/hooks/auth/use-sign-out');
      const handler = renderHook(() => useSignOut());
      await act(async () => handler.result.current.signOut());
      expect(mocks.signOut).toHaveBeenCalledOnce();
    } else {
      const { useAccountActions } = await import(
        '@/components/settings/account/use-account-actions'
      );
      const handler = renderHook(() => useAccountActions('A'));
      await act(async () => {
        if (exit === 'delete') await handler.result.current.handleDelete();
        else await handler.result.current.handleSignOut();
      });
      if (exit === 'delete')
        expect(mocks.deleteAccount).toHaveBeenCalledExactlyOnceWith({
          expectedUserId: 'A',
        });
      else expect(mocks.signOut).toHaveBeenCalledOnce();
    }
    expect(mocks.assign).toHaveBeenCalledExactlyOnceWith('/');
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
      vi.advanceTimersByTime(600);
    });
    mounted.input.unmount();
    mounted.staged.unmount();
    expect(
      Object.keys(localStorage).filter((key) =>
        key.startsWith('nham:meal-input-')
      )
    ).toEqual([]);
    expect(localStorage.getItem('unrelated')).toBe('keep');
    // Even a fresh mount of the departing owner is empty, then so is B.
    for (const userId of ['A', 'B']) {
      const input = render(
        <mounted.MealInput
          userId={userId}
          ref={mounted.ref}
          onSubmit={() => {}}
        />
      );
      const staged = renderHook(() => mounted.useStagedEntries(userId));
      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(mounted.ref.current?.getManualRows()[0].query).toBe('');
      expect(staged.result.current.entries).toEqual([]);
      input.unmount();
      staged.unmount();
    }
  });

  it('a failed sign-out preserves the current account draft', async () => {
    const mounted = await mountDraft();
    mocks.signOut.mockResolvedValue({ error: new Error('offline') });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { useSignOut } = await import('@/hooks/auth/use-sign-out');
    const handler = renderHook(() => useSignOut());
    await act(async () => handler.result.current.signOut());
    act(() => window.dispatchEvent(new Event('beforeunload')));
    expect(localStorage.getItem('nham:meal-input-draft:A')).toBe(
      'pending private text'
    );
    expect(mocks.assign).not.toHaveBeenCalled();
    expect(handler.result.current.signingOut).toBe(false);
    mounted.input.unmount();
  });
});
