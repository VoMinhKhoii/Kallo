import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CircleFeedLink } from '@/components/groups/navigation/circle-feed-link';
import { CircleFeedPanel } from '@/components/groups/navigation/circle-feed-panel';

const state = vi.hoisted(() => ({ pathname: '/circle' }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => state.pathname,
  Link: ({
    href,
    prefetch: _prefetch,
    ...props
  }: {
    href: string;
    prefetch?: boolean;
  }) => <a href={`/en${href}`} {...props} />,
}));
vi.mock('@/components/groups/friends-feed', () => ({
  FriendsFeed: () => <div>All posts</div>,
}));
vi.mock('@/components/groups/group-feed', () => ({
  GroupFeed: ({ groupId }: { groupId: string }) => <div>Group {groupId}</div>,
}));
const id = 'fbbdd9c7-dbf3-418e-8b86-98feaa8d78a3';

describe('Circle local navigation', () => {
  beforeEach(() => {
    state.pathname = '/circle';
    window.history.replaceState(null, '', '/en/circle');
    vi.restoreAllMocks();
  });

  it('switches locale-aware history without a router navigation', () => {
    const push = vi.spyOn(window.history, 'pushState');
    render(<CircleFeedLink href={`/circle/g/${id}`}>Group</CircleFeedLink>);
    fireEvent.click(screen.getByRole('link'));
    expect(push).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe(`/en/circle/g/${id}`);
  });

  it.each([
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ])('preserves native modified clicks %j', (modifier) => {
    const push = vi.spyOn(window.history, 'pushState');
    render(<CircleFeedLink href={`/circle/g/${id}`}>Group</CircleFeedLink>);
    fireEvent.click(screen.getByRole('link'), modifier);
    expect(push).not.toHaveBeenCalled();
  });

  it('uses ordinary routing from a share thread', () => {
    state.pathname = `/circle/${id}`;
    const push = vi.spyOn(window.history, 'pushState');
    render(<CircleFeedLink href="/circle">All</CircleFeedLink>);
    fireEvent.click(screen.getByRole('link'));
    expect(push).not.toHaveBeenCalled();
  });

  it('selects deep links and history changes without mounting inactive feeds', () => {
    const view = render(<CircleFeedPanel />);
    expect(screen.getByText('All posts')).toBeInTheDocument();
    state.pathname = `/circle/g/${id}`;
    view.rerender(<CircleFeedPanel />);
    expect(screen.getByText(`Group ${id}`)).toBeInTheDocument();
    expect(screen.queryByText('All posts')).not.toBeInTheDocument();
    state.pathname = `/circle/${id}`;
    view.rerender(<CircleFeedPanel />);
    expect(screen.queryByText(`Group ${id}`)).not.toBeInTheDocument();
    state.pathname = '/circle/g/not-a-uuid';
    expect(() => view.rerender(<CircleFeedPanel />)).toThrow('NEXT_NOT_FOUND');
  });
});
