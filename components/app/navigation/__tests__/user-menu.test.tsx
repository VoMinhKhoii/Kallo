import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserMenu } from '../user-menu';

const mocks = vi.hoisted(() => ({ setTheme: vi.fn() }));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/infra/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('@/hooks/theme/use-theme-choice', () => ({
  useThemeChoice: () => ['aurora', mocks.setTheme],
}));

const user = {
  email: 'minh@example.com',
  displayName: 'Minh',
  avatarUrl: null,
};

async function openMenu(collapsed = false) {
  const u = userEvent.setup();
  render(<UserMenu user={user} collapsed={collapsed} />);
  await u.click(screen.getByRole('button', { name: 'openMenu' }));
  return { u, menu: await screen.findByRole('menu') };
}

describe('UserMenu', () => {
  beforeEach(() => mocks.setTheme.mockClear());

  it('offers Settings once, Appearance and Sign out', async () => {
    const { menu } = await openMenu();

    expect(
      within(menu).getByRole('menuitem', { name: 'settings' })
    ).toHaveAttribute('href', '/settings');
    expect(within(menu).queryByText('profile')).not.toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.getAttribute('aria-label'))
    ).toEqual(['system', 'light', 'dark', 'aurora']);
    expect(
      within(menu).getByRole('menuitem', { name: 'signOut' })
    ).toBeInTheDocument();
  });

  it('marks the current theme and keeps the menu open on a new pick', async () => {
    const { u, menu } = await openMenu();

    expect(
      within(menu).getByRole('menuitemradio', { name: 'aurora' })
    ).toHaveAttribute('aria-checked', 'true');

    await u.click(within(menu).getByRole('menuitemradio', { name: 'light' }));

    expect(mocks.setTheme).toHaveBeenCalledWith('light');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('names the account only when the collapsed rail hides it', async () => {
    const { menu } = await openMenu(true);
    expect(within(menu).getByText('minh@example.com')).toBeInTheDocument();
  });

  it('leaves the name to the row it opens from when expanded', async () => {
    const { menu } = await openMenu();
    expect(
      within(menu).queryByText('minh@example.com')
    ).not.toBeInTheDocument();
  });
});
