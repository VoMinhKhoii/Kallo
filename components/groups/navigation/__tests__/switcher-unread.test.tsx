import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewSwitcher } from '@/components/groups/navigation/view-switcher';

const state = vi.hoisted(() => ({
  marker: undefined as
    | { lastReadAt: string; latestSharedAt: string | null }
    | undefined,
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/i18n/navigation', () => ({ usePathname: () => '/circle' }));
vi.mock('@/components/groups/navigation/circle-feed-link', () => ({
  CircleFeedLink: (props: React.ComponentProps<'a'>) => <a {...props} />,
}));
vi.mock('@/hooks/social/circle/use-chat-groups', () => ({
  useMyChatGroups: () => ({
    data: [{ id: 'group', kind: 'group', title: 'Group', unread: false }],
  }),
}));
vi.mock('@/hooks/social/circle/use-friend-thread-feed', () => ({
  useFriendsFeedReadMarker: () => ({ data: state.marker }),
}));
vi.mock('@/hooks/social/circle/use-circle-feed', () => ({
  useCircleFeed: () => {
    throw new Error('The switcher must not request the ambient feed');
  },
}));

describe('All unread without an ambient feed request', () => {
  beforeEach(() => {
    state.marker = undefined;
  });

  it.each([
    ['2026-11-10T12:00:00Z', true],
    ['2026-11-10T10:00:00Z', false],
    [null, false],
  ])('uses latest shared time %s (including meals eaten on older days)', (latestSharedAt, unread) => {
    state.marker = { lastReadAt: '2026-11-10T10:00:00Z', latestSharedAt };
    render(<ViewSwitcher />);
    expect(
      Boolean(
        screen
          .getByRole('link', { name: 'all' })
          .querySelector('[aria-hidden="true"]')
      )
    ).toBe(unread);
  });

  it('does not flash unread while the marker loads', () => {
    render(<ViewSwitcher />);
    expect(
      screen
        .getByRole('link', { name: 'all' })
        .querySelector('[aria-hidden="true"]')
    ).toBeNull();
  });
});
