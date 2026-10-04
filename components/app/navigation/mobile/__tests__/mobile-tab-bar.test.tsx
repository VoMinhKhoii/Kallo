import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileTabBar } from '../mobile-tab-bar';

const mocks = vi.hoisted(() => ({
  pathname: vi.fn(() => '/dashboard'),
  badges: vi.fn((): Record<string, number> => ({})),
  push: vi.fn(),
}));

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
  usePathname: () => mocks.pathname(),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/hooks/ui/use-nav-badges', () => ({
  useNavBadgeCounts: () => mocks.badges(),
}));
// The sheets' dialog form: vaul's drawer reads pointer transforms jsdom does
// not compute. Their content — what these tests assert — is the same in both.
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/dashboard/progress/quick-weight-sheet', () => ({
  QuickWeightSheet: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="weight-sheet" /> : null,
}));

function tabLinks() {
  const nav = screen.getByRole('navigation', { name: 'navigationLabel' });
  return within(nav).getAllByRole('link');
}

describe('MobileTabBar', () => {
  beforeEach(() => {
    mocks.pathname.mockReturnValue('/dashboard');
    mocks.badges.mockReturnValue({});
    mocks.push.mockReset();
  });

  it('shows the Flutter pill nav: Today, Log, +, Nutrition, Circle', () => {
    render(<MobileTabBar />);

    expect(tabLinks().map((a) => a.getAttribute('aria-label'))).toEqual([
      'today',
      'log',
      'nutrition',
      'circle',
    ]);
    expect(tabLinks().map((a) => a.getAttribute('href'))).toEqual([
      '/dashboard',
      '/logging',
      '/nutrition',
      '/circle',
    ]);
    expect(screen.getByRole('button', { name: 'add' })).toBeInTheDocument();
  });

  it('marks only the current route, including its sub-routes', () => {
    mocks.pathname.mockReturnValue('/circle/friends');
    render(<MobileTabBar />);

    const current = tabLinks().filter((a) => a.getAttribute('aria-current'));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', '/circle');
  });

  it('hides on desktop and while a text field has focus', () => {
    render(<MobileTabBar />);

    expect(screen.getByRole('navigation')).toHaveClass(
      'md:hidden',
      'typing:hidden'
    );
  });

  it('dots the Circle tab while invites are pending', () => {
    mocks.badges.mockReturnValue({ groups: 2 });
    render(<MobileTabBar />);

    const circle = tabLinks().find((a) => a.getAttribute('href') === '/circle');
    expect(circle?.querySelector('.bg-kallo-accent')).not.toBeNull();
  });

  it('opens the Add sheet; Log a meal goes to the logging feed', async () => {
    const user = userEvent.setup();
    render(<MobileTabBar />);
    await user.click(screen.getByRole('button', { name: 'add' }));

    const sheet = await screen.findByRole('dialog');
    await user.click(within(sheet).getByRole('button', { name: /logMeal/ }));
    expect(mocks.push).toHaveBeenCalledWith('/logging');
  });

  it('Log weight swaps the Add sheet for the weigh-in sheet', async () => {
    const user = userEvent.setup();
    render(<MobileTabBar />);
    await user.click(screen.getByRole('button', { name: 'add' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: /logWeight/,
      })
    );

    expect(
      await screen.findByRole('dialog', { name: 'weight-sheet' })
    ).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('returns focus to the + button when the Add sheet closes', async () => {
    const user = userEvent.setup();
    render(<MobileTabBar />);
    const plus = screen.getByRole('button', { name: 'add' });
    await user.click(plus);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(plus).toHaveFocus());
  });

  it('steps aside on the full-screen logging feed', () => {
    mocks.pathname.mockReturnValue('/logging');
    const { container, unmount } = render(<MobileTabBar />);
    expect(container).toBeEmptyDOMElement();
    unmount();

    mocks.pathname.mockReturnValue('/logging/anything');
    expect(render(<MobileTabBar />).container).toBeEmptyDOMElement();
  });
});
