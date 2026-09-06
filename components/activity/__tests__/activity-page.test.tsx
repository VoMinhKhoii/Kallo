// The badge clear is gated on the FEED response, never on the badge poll's
// cached count: the two are separate queries on separate timers, so a
// notification that arrives between polls is rendered here while the cached
// count still reads zero. Gating on that count would render the row and never
// mark it seen — a badge stuck on a page the user is looking at.

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  NotificationFeedPage,
  NotificationItem,
} from '@/lib/domain/notifications/contracts';
import { ActivityPage } from '../activity-page';

const { feedMock, markSeenMock } = vi.hoisted(() => ({
  feedMock: vi.fn(),
  markSeenMock: vi.fn(),
}));

vi.mock('@/hooks/notifications/use-notification-feed', () => ({
  useNotificationFeed: () => feedMock(),
}));
vi.mock('@/hooks/notifications/use-notification-state', () => ({
  useMarkNotificationsSeen: () => ({ mutate: markSeenMock }),
}));
// The list itself is covered by activity-sections.test.tsx.
vi.mock('../activity-sections', () => ({
  ActivitySections: ({ items }: { items: NotificationItem[] }) => (
    <div data-testid="sections">{items.length}</div>
  ),
}));

const OLDER = '2026-08-27T10:00:00.000Z';
const NEWEST = '2026-08-28T10:00:00.000Z';

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    type: 'share.reaction',
    actors: [],
    actorCount: 1,
    objectType: 'share',
    objectId: 's1',
    targetType: null,
    targetId: null,
    data: null,
    createdAt: OLDER,
    updatedAt: OLDER,
    seenAt: OLDER,
    readAt: null,
    invite: null,
    ...overrides,
  };
}

function feed(pages: NotificationFeedPage[]) {
  feedMock.mockReturnValue({
    data: { pages, pageParams: [] },
    isSuccess: true,
    isPending: false,
    isError: false,
    isFetching: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  });
}

describe('ActivityPage mark-seen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks seen from the server count carried by the feed response', () => {
    feed([
      {
        items: [item(), item({ id: 'n2', createdAt: NEWEST })],
        nextCursor: null,
        unseenCount: 2,
      },
    ]);

    render(<ActivityPage />);

    expect(markSeenMock).toHaveBeenCalledWith(NEWEST);
  });

  // The arrival between two badge polls: the row is in the page we rendered,
  // unseen, while the count that came with the page is already behind.
  it('marks seen for an unseen item even when the response count is zero', () => {
    feed([
      {
        items: [item({ id: 'n2', createdAt: NEWEST, seenAt: null })],
        nextCursor: null,
        unseenCount: 0,
      },
    ]);

    render(<ActivityPage />);

    expect(markSeenMock).toHaveBeenCalledWith(NEWEST);
  });

  it('stays quiet when the whole feed is already seen', () => {
    feed([{ items: [item()], nextCursor: null, unseenCount: 0 }]);

    render(<ActivityPage />);

    expect(markSeenMock).not.toHaveBeenCalled();
  });

  // Mark-seen invalidates the feed, so without the guard every round trip
  // would post again.
  it('posts the watermark once per visit', () => {
    feed([
      { items: [item({ seenAt: null })], nextCursor: null, unseenCount: 1 },
    ]);

    const { rerender } = render(<ActivityPage />);
    rerender(<ActivityPage />);

    expect(markSeenMock).toHaveBeenCalledTimes(1);
  });

  it('renders the empty state without posting anything', () => {
    feed([{ items: [], nextCursor: null, unseenCount: 0 }]);

    render(<ActivityPage />);

    expect(screen.queryByTestId('sections')).not.toBeInTheDocument();
    expect(markSeenMock).not.toHaveBeenCalled();
  });
});
