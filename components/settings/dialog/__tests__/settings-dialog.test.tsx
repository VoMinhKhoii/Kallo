import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useFormContext } from 'react-hook-form';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsPageId } from '@/lib/domain/settings/pages';
import { SettingsDialog } from '../settings-dialog';
import type { SettingsProfile } from '../types';

const mocks = vi.hoisted(() => ({ isMobile: false }));

// Next syncs useSearchParams to native history calls; mirror that here so the
// dialog re-renders when it writes the URL.
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (onChange: () => void) => {
    window.addEventListener('locationchange', onChange);
    return () => window.removeEventListener('locationchange', onChange);
  };
  return {
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(subscribe, () => window.location.search)
      ),
  };
});
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => mocks.isMobile }));

// Each page's own rows have their own tests; here a page is its id, plus a
// field edit for checking the shared save bar.
vi.mock('../page-content', () => ({
  PageContent: ({ page }: { page: SettingsPageId }) => <PageStub page={page} />,
}));
function PageStub({ page }: { page: SettingsPageId }) {
  const form = useFormContext();
  return (
    <div>
      <p>page:{page}</p>
      {form && (
        <button
          type="button"
          onClick={() => form.setValue('age', 31, { shouldDirty: true })}
        >
          edit age
        </button>
      )}
    </div>
  );
}

const DEFAULTS = {
  biologicalSex: 'male',
  weightKg: 70,
  heightCm: 175,
  age: 30,
  activityLevel: 'moderate',
  goal: 'maintaining',
  aggression: null,
  carbSplit: 'moderate_carb',
};
const handleCancel = vi.fn();
vi.mock('@/hooks/profile/use-profile-form', () => ({
  useProfileForm: () => {
    const form = useForm({ defaultValues: DEFAULTS });
    return {
      form,
      isPending: false,
      onSubmit: vi.fn(),
      handleCancel: () => {
        handleCancel();
        form.reset(DEFAULTS);
      },
    };
  },
}));

const PROFILE = { autoShareToCircle: false } as SettingsProfile;

function setUrl(url: string) {
  act(() => window.history.replaceState(null, '', url));
}

function renderDialog(profile: SettingsProfile | null = null) {
  return render(
    <SettingsDialog profile={profile} userId="user-1" email="a@b.co" />
  );
}

describe('SettingsDialog', () => {
  beforeAll(() => {
    for (const method of ['pushState', 'replaceState'] as const) {
      const original = window.history[method].bind(window.history);
      window.history[method] = (...args: Parameters<History['pushState']>) => {
        original(...args);
        window.dispatchEvent(new Event('locationchange'));
      };
    }
  });

  beforeEach(() => {
    mocks.isMobile = false;
    setUrl('/en/dashboard');
  });

  it('stays closed until the URL asks for it', () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).toBeNull();

    setUrl('/en/dashboard?settings=');
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText('page:profile')).toBeVisible();
  });

  it('lists the pages in a rail and switches page in the URL', async () => {
    setUrl('/en/dashboard?settings=');
    renderDialog(PROFILE);
    const rail = screen.getByRole('navigation', { name: 'title' });
    const items = within(rail)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(items).toEqual([
      'pages.profile.title',
      'pages.body.title',
      'pages.preferences.title',
      'pages.cooking.title',
      'pages.privacy.title',
      'pages.subscriptions.title',
      'pages.account.title',
      'pages.feedback.title',
    ]);

    await userEvent.click(within(rail).getByText('pages.subscriptions.title'));

    expect(new URLSearchParams(window.location.search).get('settings')).toBe(
      'subscriptions'
    );
    expect(screen.getByText('page:subscriptions')).toBeVisible();
    expect(within(rail).getByText('pages.subscriptions.title')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('hides the body and cooking pages before onboarding, even by URL', () => {
    setUrl('/en/dashboard?settings=body');
    renderDialog(null);
    const rail = screen.getByRole('navigation', { name: 'title' });
    expect(within(rail).queryByText('pages.body.title')).toBeNull();
    expect(within(rail).queryByText('pages.cooking.title')).toBeNull();
    expect(screen.getByText('page:profile')).toBeVisible();
  });

  it('closes from the close button and drops the param', async () => {
    setUrl('/en/dashboard?settings=account');
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(window.location.search).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the save bar on every page while edits are unsaved', async () => {
    setUrl('/en/dashboard?settings=body');
    renderDialog(PROFILE);
    expect(screen.queryByRole('button', { name: 'save' })).toBeNull();

    await userEvent.click(screen.getByText('edit age'));
    const rail = screen.getByRole('navigation', { name: 'title' });
    await userEvent.click(within(rail).getByText('pages.feedback.title'));

    expect(screen.getByText('page:feedback')).toBeVisible();
    // Present, not visible: jsdom never runs the bar's fade-in.
    expect(screen.getByRole('button', { name: /save/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(handleCancel).toHaveBeenCalled();
  });

  it('keeps unsaved edits when the dialog closes and reopens', async () => {
    setUrl('/en/dashboard?settings=body');
    renderDialog(PROFILE);
    await userEvent.click(screen.getByText('edit age'));

    await userEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    setUrl('/en/dashboard?settings=cooking');

    // Present, not visible: jsdom never runs the bar's fade-in.
    expect(screen.getByRole('button', { name: /save/ })).toBeInTheDocument();
  });

  describe('on a phone', () => {
    beforeEach(() => {
      mocks.isMobile = true;
    });

    it('opens on the page list and pushes a page in with a way back', async () => {
      setUrl('/en/dashboard?settings=');
      renderDialog(PROFILE);
      expect(screen.queryByText(/^page:/)).toBeNull();

      await userEvent.click(
        screen.getByRole('button', { name: 'pages.cooking.title' })
      );
      expect(screen.getByText('page:cooking')).toBeVisible();
      expect(new URLSearchParams(window.location.search).get('settings')).toBe(
        'cooking'
      );

      await userEvent.click(screen.getByRole('button', { name: 'title' }));
      expect(new URLSearchParams(window.location.search).get('settings')).toBe(
        ''
      );
    });
  });
});
